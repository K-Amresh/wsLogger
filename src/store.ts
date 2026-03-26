import { create } from "zustand";
import type { WsConnection, WsMessage } from "./types";

interface CorrelationEntry {
  responseIndex: number | null;
  waitTime: number | null;
}

export interface MessageSelection {
  connectionId: string;
  index: number;
}

interface Store {
  connections: Record<string, WsConnection>;
  messages: Record<string, WsMessage[]>;
  selectedConnectionId: string | null;
  searchQuery: string;
  selectedMessage: MessageSelection | null;
  isRecording: boolean;

  pendingRequests: Record<string, number>;
  correlations: Record<string, Record<number, CorrelationEntry>>;
  responseToRequest: Record<string, Record<number, number>>;

  addConnection: (conn: WsConnection) => void;
  updateConnectionStatus: (
    id: string,
    status: WsConnection["status"],
  ) => void;
  addMessage: (msg: WsMessage) => void;
  selectConnection: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectMessage: (sel: MessageSelection | null) => void;
  setRecording: (recording: boolean) => void;
  clearAll: () => void;
  clearConnectionMessages: (connectionId: string) => void;
}

export const useStore = create<Store>()((set) => ({
  connections: {},
  messages: {},
  selectedConnectionId: null,
  searchQuery: "",
  selectedMessage: null,
  isRecording: false,

  pendingRequests: {},
  correlations: {},
  responseToRequest: {},

  addConnection: (conn) =>
    set((state) => ({
      connections: { ...state.connections, [conn.id]: conn },
    })),

  updateConnectionStatus: (id, status) =>
    set((state) => {
      const conn = state.connections[id];
      if (!conn) return state;
      return {
        connections: { ...state.connections, [id]: { ...conn, status } },
      };
    }),

  addMessage: (msg) =>
    set((state) => {
      const connMsgs = state.messages[msg.connectionId] ?? [];
      const newMsgs = [...connMsgs, msg];
      const msgIndex = newMsgs.length - 1;

      const conn = state.connections[msg.connectionId];
      const updatedConnections = conn
        ? {
            ...state.connections,
            [msg.connectionId]: {
              ...conn,
              messageCount: conn.messageCount + 1,
            },
          }
        : state.connections;

      let newPending = state.pendingRequests;
      let connCorr = state.correlations[msg.connectionId] ?? {};
      let connRtoR = state.responseToRequest[msg.connectionId] ?? {};
      let corrChanged = false;

      if (msg.parsedId != null) {
        const key = `${msg.connectionId}::${msg.parsedId}`;

        if (msg.direction === "sent") {
          newPending = { ...newPending, [key]: msgIndex };
          connCorr = {
            ...connCorr,
            [msgIndex]: { responseIndex: null, waitTime: null },
          };
          corrChanged = true;
        } else {
          const requestIndex = newPending[key];
          if (requestIndex != null) {
            const requestMsg = connMsgs[requestIndex];
            if (requestMsg) {
              const waitTime = msg.timestamp - requestMsg.timestamp;
              connCorr = {
                ...connCorr,
                [requestIndex]: { responseIndex: msgIndex, waitTime },
              };
              connRtoR = { ...connRtoR, [msgIndex]: requestIndex };
              newPending = { ...newPending };
              delete newPending[key];
              corrChanged = true;
            }
          }
        }
      }

      return {
        messages: { ...state.messages, [msg.connectionId]: newMsgs },
        connections: updatedConnections,
        pendingRequests: newPending,
        correlations: corrChanged
          ? { ...state.correlations, [msg.connectionId]: connCorr }
          : state.correlations,
        responseToRequest: corrChanged
          ? { ...state.responseToRequest, [msg.connectionId]: connRtoR }
          : state.responseToRequest,
      };
    }),

  selectConnection: (id) =>
    set({ selectedConnectionId: id, selectedMessage: null }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  selectMessage: (sel) => set({ selectedMessage: sel }),

  setRecording: (isRecording) => set({ isRecording }),

  clearAll: () =>
    set({
      connections: {},
      messages: {},
      selectedConnectionId: null,
      selectedMessage: null,
      pendingRequests: {},
      correlations: {},
      responseToRequest: {},
    }),

  clearConnectionMessages: (connectionId) =>
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[connectionId];

      const newCorrelations = { ...state.correlations };
      delete newCorrelations[connectionId];

      const newRtoR = { ...state.responseToRequest };
      delete newRtoR[connectionId];

      const newPending = { ...state.pendingRequests };
      for (const key of Object.keys(newPending)) {
        if (key.startsWith(connectionId + "::")) {
          delete newPending[key];
        }
      }

      const conn = state.connections[connectionId];
      const updatedConnections = conn
        ? {
            ...state.connections,
            [connectionId]: { ...conn, messageCount: 0 },
          }
        : state.connections;

      const newSelectedMessage =
        state.selectedMessage?.connectionId === connectionId
          ? null
          : state.selectedMessage;

      return {
        messages: newMessages,
        connections: updatedConnections,
        correlations: newCorrelations,
        responseToRequest: newRtoR,
        pendingRequests: newPending,
        selectedMessage: newSelectedMessage,
      };
    }),
}));
