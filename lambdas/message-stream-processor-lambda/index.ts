import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  getUserProfile,
  updateConversationState,
} from "../shared/database-helper";
import { logger } from "../shared/logger";
import type { DynamoDBStreamEvent, DynamoDBRecord, Context } from "aws-lambda";

const lambda = new LambdaClient({});

const AI_LAMBDA_NAME = process.env.AI_LAMBDA_NAME!;

interface StreamRecord {
  eventName?: string;
  dynamodb?: {
    NewImage?: any;
  };
}

interface ProcessedItem {
  role?: string;
  type?: string;
  PK?: string;
  SK?: string;
}

/**
 * Validates and extracts the item from the DynamoDB Stream record
 * Returns null if the record should not be processed
 */
function extractValidItem(record: StreamRecord): ProcessedItem | null {
  if (record.eventName !== "INSERT") return null;

  const image = record.dynamodb?.NewImage;
  if (!image) return null;

  const item = unmarshall(image);
  if (item.role !== "USER" || item.type !== "TEXT") return null;

  return item;
}

/**
 * Validates if the conversation state allows processing the message
 */
function isValidState(state: string): boolean {
  if (state === "PROCESSING_AI") {
    logger.info("AI already processing, skipping");
    return false;
  }

  if (!["WAITING_TEXT", "IDLE"].includes(state)) {
    logger.info("Invalid state, skipping", { state });
    return false;
  }

  return true;
}

/**
 * Invokes the AI lambda asynchronously
 */
async function invokeAiLambda(
  chatId: number,
  messageId: string
): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: AI_LAMBDA_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({
          chatId,
          triggerMessageId: messageId,
        })
      ),
    })
  );
  logger.info("AI lambda invoked");
}

/**
 * Processes an individual record from the stream
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const item = extractValidItem(record);
  if (!item) return;

  const chatId = Number(item.PK!.split("#")[1]);
  const messageId = item.SK!;
  logger.appendKeys({
    chatId,
    messageId,
  });

  logger.info("Processing message");

  const profile = await getUserProfile(chatId);
  if (!profile) {
    logger.warn("User profile not found");
    return;
  }

  const state = profile.conversationState;
  if (!state || !isValidState(state)) {
    logger.info("Skipping due to invalid state", { state });
    return;
  }

  try {
    await updateConversationState(chatId, "PROCESSING_AI");
    await invokeAiLambda(chatId, messageId);

    logger.info("AI processing started");
  } catch (error: any) {
    logger.error("Failed to invoke AI lambda", {
      chatId,
      messageId,
      error: error.message,
    });
  }
}

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<any> => {
  logger.addContext(context);
  logger.info("Stream batch received", {
    recordCount: event.Records?.length,
  });

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error: any) {
      logger.error("Unhandled error processing record", {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      logger.removeKeys(["chatId", "messageId"]);
    }
  }

  return { ok: true };
};
