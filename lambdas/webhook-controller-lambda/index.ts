import { logger } from "../shared/logger";
import { runCommands } from "./helpers/commands-helper";
import { updateConversationState, putHistory } from "../shared/database-helper";
import type { APIGatewayEvent, Context } from "aws-lambda";

export const handler = async (event: APIGatewayEvent, context: Context) => {
  logger.addContext(context);
  logger.info("Incoming Telegram webhook");

  const body = event.body ? JSON.parse(event.body) : {};

  if (!body.message) {
    logger.warn("Webhook without message, ignored");
    return { statusCode: 200, body: "ignored" };
  }

  const message = body.message;
  const chatId = message?.chat?.id;
  const text = message?.text;
  const from = message?.from;

  try {
    // TODO: Allow another type of message
    if (!chatId || !text) {
      logger.warn("Invalid message structure, ignored");
      return { statusCode: 200, body: "ignored" };
    }

    logger.appendKeys({
      chatId,
      messageType: text ? "TEXT" : "AUDIO",
    });

    if (text.startsWith("/")) {
      const command = text.substring(1);
      logger.info("Command received", { command });

      await runCommands(command, chatId, from);
    } else {
      logger.info("Text message received");

      await putHistory(chatId, text, "USER", "TEXT");
      await updateConversationState(chatId, "WAITING_TEXT");
    }

    logger.info("Webhook processed successfully");
    return { statusCode: 200, body: "ok" };
  } catch (error) {
    logger.error("Unhandled error in webhook-controller", error as Error);

    await updateConversationState(chatId, "ERROR");

    return { statusCode: 200, body: "ok" };
  }
};
