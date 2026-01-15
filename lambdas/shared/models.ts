export type ConversationState =
  | "NEW"
  | "IDLE"
  | "WAITING_TEXT"
  | "PROCESSING_AI"
  | "ERROR";

export type Pofile = {
  PK: string;
  SK: string;
  chatId: 5186626938;
  conversationState: ConversationState;
  createdAt: string;
  firstName: string;
  lastName: string;
  source: string;
  updatedAt: string;
  username: string;
};
