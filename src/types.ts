export interface WsConnection {
  id: string;
  url: string;
  status: "connecting" | "open" | "closed" | "error";
  connectStack: string;
  createdAt: number;
  messageCount: number;
}

export interface WsMessage {
  connectionId: string;
  direction: "sent" | "received";
  data: string;
  parsedId: string | null;
  stack: string;
  timestamp: number;
}

export type MessageFilter = "all" | "sent" | "received";
