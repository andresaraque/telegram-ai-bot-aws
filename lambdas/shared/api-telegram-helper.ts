import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({});
let cachedSecrets: any;

// ---------- Secrets cache ----------
export async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const command = new GetSecretValueCommand({
    SecretId: process.env.LINGOMATE_SECRET_ARN!,
  });

  const response = await secretsClient.send(command);
  cachedSecrets = JSON.parse(response.SecretString!);

  return cachedSecrets;
}

function telegramApi(token: string) {
  return `https://api.telegram.org/bot${token}`;
}

// ---------- Send message ----------
export async function sendMessage(chatId: number, message: string) {
  const { TELEGRAM_VERIFY_TOKEN } = await getSecrets();

  await fetch(`${telegramApi(TELEGRAM_VERIFY_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });
}
