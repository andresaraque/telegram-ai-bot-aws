import { sendMessage } from "../../shared/api-telegram-helper";
import {
  getItemDb,
  putHistory,
  putItemDb,
  updateConversationState,
} from "../../shared/database-helper";
import { logger } from "../../shared/logger";

export const runCommands = async (
  command: string,
  chatId: number,
  from: any
) => {
  logger.appendKeys({ command });

  const pk = `USER#${chatId}`;
  const skProfile = "PROFILE";

  try {
    logger.info("Executing command");
    switch (command) {
      case "start": {
        logger.info("Handling /start command");

        // Is User already exists?
        const existingUser = await getItemDb(pk, skProfile);

        if (existingUser.Item) {
          await putHistory(chatId, "/start-old-user", "USER", "COMMAND");
          await updateConversationState(chatId, "WAITING_TEXT");

          const aiReply = `Hi again ${
            from?.first_name ?? ""
          }, what's going on?`;
          await sendMessage(chatId, aiReply);

          await putHistory(chatId, aiReply, "ASSISTANT", "TEXT");
          await updateConversationState(chatId, "IDLE");
        } else {
          await putItemDb({
            // First time
            PK: { S: pk },
            SK: { S: skProfile },
            chatId: { N: chatId.toString() },
            username: { S: from?.username ?? "unknown" },
            firstName: { S: from?.first_name ?? "" },
            lastName: { S: from?.last_name ?? "" },
            createdAt: { S: new Date().toISOString() },
            source: { S: "telegram" },
            conversationState: { S: "NEW" }, // NEW, IDLE, WAITING_TEXT, PROCESSING_AI, ERROR
            updatedAt: { S: new Date().toISOString() },
          });
          await putHistory(chatId, "/start-new-user", "USER", "COMMAND");

          const aiReply = "Hi! I am Erik, let's talk";
          await sendMessage(chatId, aiReply);

          await putHistory(chatId, aiReply, "ASSISTANT", "TEXT");
          await updateConversationState(chatId, "IDLE");
        }
        break;
      }
      case "help": {
        logger.info("Handling /help command");
        await putHistory(chatId, `/${command}`, "USER", "COMMAND");
        await updateConversationState(chatId, "WAITING_TEXT");

        const aiReply =
          "I can help you with a simple conversation\n\n" +
          "So tell me anything\n";

        await sendMessage(chatId, aiReply);
        await putHistory(chatId, aiReply, "ASSISTANT", "TEXT");
        await updateConversationState(chatId, "IDLE");

        break;
      }
      default: {
        logger.warn("Unknown command received");
        await putHistory(chatId, `/${command}`, "USER", "COMMAND");
        await updateConversationState(chatId, "WAITING_TEXT");

        const aiReply = "Hey, I don't know that command";

        await sendMessage(chatId, aiReply);
        await putHistory(chatId, aiReply, "ASSISTANT", "TEXT");
        await updateConversationState(chatId, "IDLE");

        break;
      }
    }
  } catch (error) {
    logger.error("Command execution failed", error as Error);

    await sendMessage(
      chatId,
      "Sorry, something went wrong. Please try again 🙏"
    );

    throw error;
  }
};
