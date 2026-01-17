import {
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  type StackProps,
  CfnOutput
} from "aws-cdk-lib";
import { HttpApi, HttpMethod, HttpStage } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AttributeType,
  Table,
  BillingMode,
  StreamViewType,
} from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, FilterCriteria, Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
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
    const messageStreamProcessorFnName =
      "telegram-bot-message-stream-processor";
    const aiReplyFnName = "telegram-bot-ai-reply";

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

    /**************************************
    -------- AI REPLY LAMBDA --------
    **************************************/
    const logGroupAiReply = new LogGroup(this, "TelegramAiReplyLogGroup", {
      logGroupName: `/aws/lambda/${aiReplyFnName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_WEEK,
    });

    const aiReplyLambda = new NodejsFunction(this, "TelegramAiReplyLambda", {
      functionName: aiReplyFnName,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(40), // Take more time
      entry: "lambdas/ai-reply-lambda/index.ts",
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
        LOG_LEVEL: logLevel
      },
      logGroup: logGroupAiReply,
    });

    // AiReplyLambda grant permission to read & write DB
    usersTable.grantReadWriteData(aiReplyLambda);

    // AiReplyLambda grant permission to read secrets
    telegramSecret.grantRead(aiReplyLambda);

    //TODO: Change for specific region
    aiReplyLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0"],
      })
    );

    /**************************************
    ----- MESSAGGE STREAM PROCESSOR LAMBDA -----
    **************************************/
    const logGroupMessageStreamProcessor = new LogGroup(
      this,
      "TelegramStreamProcessorGroup",
      {
        logGroupName: `/aws/lambda/${messageStreamProcessorFnName}`,
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.ONE_WEEK,
      }
    );

    const messageStreamProcessorLambda = new NodejsFunction(
      this,
      "TelegramMessageStreamProcessorLambda",
      {
        functionName: messageStreamProcessorFnName,
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(7),
        entry: "lambdas/message-stream-processor-lambda/index.ts",
        handler: "handler",
        bundling: {
          minify: true,
          mainFields: ["module", "main"],
          sourceMap: false, // For debug
          format: OutputFormat.ESM,
        },
        environment: {
          TABLE_NAME: usersTable.tableName,
          AI_LAMBDA_NAME: aiReplyLambda.functionName,
          LOG_LEVEL: logLevel
        },
        logGroup: logGroupMessageStreamProcessor,
      }
    );

    // Stream the DynamoDB Events to message-stream-processor-lambda
    messageStreamProcessorLambda.addEventSource(
      new DynamoEventSource(usersTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 5,
        retryAttempts: 2,
        filters: [
          FilterCriteria.filter({
            eventName: ["INSERT"],
            dynamodb: {
              NewImage: {
                SK: {
                  S: [{ prefix: "MESSAGE#" }],
                },
                type: { S: ["TEXT"] },
                role: { S: ["USER"] },
              },
            },
          }),
        ],
      })
    );

    // MessageStreamProcessorLambda grant permission to dynamodb:GetRecords from DB stream
    usersTable.grantStreamRead(messageStreamProcessorLambda);

    // MessageStreamProcessorLambda grant permission to read & write DB
    usersTable.grantReadWriteData(messageStreamProcessorLambda);

    // MessageStreamProcessorLambda grant permission to invoke aiReplyLambda
    aiReplyLambda.grantInvoke(messageStreamProcessorLambda);

    /**************************************
    -------- HTTP API GATEWAY --------
    **************************************/
    const httpApi = new HttpApi(this, "TelegramHttpApi", {
      apiName: "telegram-example",
      createDefaultStage: false,
    });

    const integration = new HttpLambdaIntegration(
      "TelegramWebhookControllerLambdaIntegration",
      webhookControllerLambda
    );

    httpApi.addRoutes({
      path: "/webhook",
      methods: [HttpMethod.POST],
      integration,
    });

    // Stage for API --> PRO
    new HttpStage(this, "ProStage", {
      httpApi,
      stageName: "pro",
      autoDeploy: true,
    });

    /* ---- TERMINAL OUTPUTS ---- */
    new CfnOutput(this, "WebhookUrlApiGatewayPRO", {
      value: `${httpApi.apiEndpoint}/pro/webhook`,
    });
  }
}
