import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { ConversationState, Pofile } from "./models";
import { logger } from "./logger";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoClient = new DynamoDBClient({});

export async function getItemDb(pk: string, sk: string) {
  const getItemCmd = new GetItemCommand({
    TableName: process.env.TABLE_NAME!,
    Key: {
      PK: { S: pk },
      SK: { S: sk },
    },
  });

  return await dynamoClient.send(getItemCmd);
}

export async function putItemDb(item: any) {
  const putItemCmd = new PutItemCommand({
    TableName: process.env.TABLE_NAME!,
    Item: item,
  });

  return await dynamoClient.send(putItemCmd);
}

async function updateItemDb(
  pk: string,
  sk: string,
  attributes: Record<string, any>
) {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: any = {};
  const expressionAttributeValues: any = {};

  Object.entries(attributes).forEach(([key, value]) => {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  });
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: process.env.TABLE_NAME!,
      Key: {
        PK: { S: pk },
        SK: { S: sk },
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

function ttlInDays(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

export async function putHistory(
  chatId: number,
  contentText: string,
  role: "USER" | "ASSISTANT" | "SYSTEM",
  type: "TEXT" | "AUDIO" | "IMAGE" | "COMMAND" | "GIF"
) {
  const nowIso = new Date().toISOString();

  await putItemDb({
    PK: { S: `USER#${chatId}` },
    SK: { S: `MESSAGE#${nowIso}` },
    role: { S: role },
    content: { S: contentText },
    type: { S: type },
    createdAt: { S: nowIso },
    expiresAt: { N: ttlInDays(30).toString() },
  });
}

export async function updateConversationState(
  chatId: number,
  conversationState: ConversationState
) {
  await updateItemDb(`USER#${chatId}`, "PROFILE", {
    conversationState: { S: conversationState },
    updatedAt: { S: new Date().toISOString() },
  });
}

/**
 * Gets the user's profile from DynamoDB
 */
export async function getUserProfile(chatId: number): Promise<Pofile | null> {
  const profileRes = await dynamoClient.send(
    new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: { S: `USER#${chatId}` },
        SK: { S: "PROFILE" },
      },
      ConsistentRead: true,
    })
  );

  if (!profileRes.Item) {
    logger.warn("Profile not found, skipping");
    return null;
  }

  return unmarshall(profileRes.Item) as Pofile;
}
