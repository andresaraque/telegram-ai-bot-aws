import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockMessage, ChatMessage, Pofile } from "./models";
import {
  ERIK_SYSTEM_PROMPT_TEMPLATE,
  renderPromptTemplate,
} from "./prompt-templates";

const client = new BedrockRuntimeClient({});

export async function callLLM(messages: BedrockMessage[]): Promise<string> {
  const command = new InvokeModelCommand({
    modelId: "amazon.nova-pro-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      messages,
      inferenceConfig: {
        maxTokens: 120,
        temperature: 0.5,
        topP: 0.9,
      },
    }),
  });

  const response = await client.send(command);

  const body = JSON.parse(Buffer.from(response.body).toString("utf-8"));

  return body.output.message.content[0].text;
}


/**
 * Builds the system + user messages for the chat model.
 *
 * @param params.profile User profile information
 * @param params.history Conversation history
 * @param params.promptTemplate Optional system prompt variant
 *
 * @example
 * ```ts
 * const messages = buildPrompt({
 *   profile,
 *   history,
 *   promptTemplate: PROMPT_VARIANTS.CALM,
 * });
 * ```
 */
export function buildPrompt({
  profile,
  history,
  promptTemplate = ERIK_SYSTEM_PROMPT_TEMPLATE,
}: {
  profile: Pofile;
  history: ChatMessage[];
  promptTemplate?: string;
}): BedrockMessage[] {
  const systemInstruction = renderPromptTemplate(promptTemplate, profile);

  return [
    {
      role: "user",
      content: [
        {
          text: systemInstruction,
        },
      ],
    },
    ...history.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
  ];
}
