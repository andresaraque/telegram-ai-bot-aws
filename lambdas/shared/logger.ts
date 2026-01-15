import { Logger } from "@aws-lambda-powertools/logger";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

export const logger = new Logger({
  serviceName: "telegram-bot",
  logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
});
