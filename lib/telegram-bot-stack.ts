import {
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import {
  AttributeType,
  Table,
  BillingMode,
  StreamViewType,
} from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class TelegramBotStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const logLevel = "DEBUG";

    /**************************************
    -------- LAMBDAS FUNCTION NAME --------
    **************************************/
    const webhookControllerFnName = "telegram-bot-webhook-controller";

    /**************************************
    -------- SECRETS MANAGER --------
    **************************************/
    const telegramSecret = new Secret(this, "TelegramWebhookConnectionSecret", {
      secretName: "telegram-ai-example/webhook-connection-token",
      description: "Secret for telegram webhook DEV",
      secretObjectValue: {
        TELEGRAM_VERIFY_TOKEN: SecretValue.unsafePlainText(
          "telegram-token-change-me-after-deploy"
        ),
      },
    });

    /**************************************
    -------- DYNAMODB TABLE --------
    **************************************/
    const usersTable = new Table(this, "TelegramAiUsersTable", {
      tableName: "telegram-ai-users-example",
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY, // DEV only
      timeToLiveAttribute: "expiresAt",
    });

    /**************************************
    ---- WEBHOOK CONTROLLER LAMBDA ----
    **************************************/
    const logGroupWebhookController = new LogGroup(
      this,
      "TelegramWebhookControllerLogGroup",
      {
        logGroupName: `/aws/lambda/${webhookControllerFnName}`,
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.ONE_WEEK,
      }
    );

    const webhookControllerLambda = new NodejsFunction(
      this,
      "TelegramWebhookControllerLambda",
      {
        functionName: webhookControllerFnName,
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(7),
        entry: "lambdas/webhook-controller-lambda/index.ts",
        handler: "handler",
        bundling: {
          minify: true, 
          mainFields: ["module", "main"],
          sourceMap: false, // For debug
          format: OutputFormat.ESM,
        },
        environment: {
          TELEGRAM_SECRET_ARN: telegramSecret.secretArn,
          TABLE_NAME: usersTable.tableName,
          LOG_LEVEL: logLevel,
        },
        logGroup: logGroupWebhookController,
      }
    );

    // WebhookControllerLambda grant permission to read & write DB
    usersTable.grantReadWriteData(webhookControllerLambda);

    // WebhookControllerLambda grant permission to read secrets
    telegramSecret.grantRead(webhookControllerLambda);
  }

  
}
