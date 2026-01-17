import type { Context } from "aws-lambda";
import { logger } from "../shared/logger";
export const handler = async (
  event: { chatId: number; triggerMessageId: string },
  context: Context
) => {
  logger.addContext(context);
  logger.info("AI reply triggered", { event });
};
