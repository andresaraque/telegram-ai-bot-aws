import { sendMessage } from "../shared/api-telegram-helper";
import { buildPrompt, callLLM } from "../shared/bedrock-model";
import {
  getLastMessages,
  getUserProfile,
  putHistory,
  updateConversationState,
} from "../shared/database-helper";
import type { Context } from "aws-lambda";
import { logger } from "../shared/logger";

export const handler = async (
  event: { chatId: number; triggerMessageId: string },
  context: Context
) => {
  logger.addContext(context);

  const { chatId, triggerMessageId } = event;
  logger.appendKeys({ chatId, messageId: triggerMessageId });

  logger.info("AI reply triggered");

  try {
    const profile = await getUserProfile(chatId);

    if (!profile) {
      logger.warn("Profile not found, skipping AI reply");
      return { statusCode: 204 };
    }

    const history = await getLastMessages(chatId, 15);

    logger.debug("Conversation history loaded", {
      historyLength: history.length,
    });


    /**
    * @example with another prompt
    *
    * const messages = buildPrompt({
    *   profile,
    *   history,
    *   promptTemplate: PROMPT_VARIANTS.CALM,
    * });
    *
    */
    const messages = buildPrompt({ profile, history });

    logger.debug("Prompt built", {
      messageCount: messages.length,
    });

    const aiResponse = await callLLM(messages);

    logger.info("AI response generated", {
      responseLength: aiResponse.length,
    });

    await putHistory(chatId, aiResponse, "ASSISTANT", "TEXT");

    await updateConversationState(chatId, "IDLE");

    await sendMessage(chatId, aiResponse);

    logger.info("AI reply sent successfully");

    return { statusCode: 200, body: "ok" };
  } catch (error) {
    logger.error("Error handling AI reply", { error });

    await updateConversationState(chatId, "ERROR");

    throw error;
  }
};
