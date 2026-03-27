import { create } from "zustand";
import type { WsConnection, WsMessage } from "./types";
import { normalizeMockAction } from "./utils";

export interface CorrelationEntry {
  responseIndices: number[];
  waitTimes: number[];
}

export interface HarWebSocketMessage {
  type: "send" | "receive";
  time: number;
  opcode: number;
  data: string;
  _parsedId?: string | null;
  _stack?: string;
}

export interface HarEntry {
  startedDateTime: string;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: unknown[];
    queryString: unknown[];
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: unknown[];
    content: { size: number; mimeType: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, never>;
  timings: { send: number; wait: number; receive: number };
  _webSocketMessages: HarWebSocketMessage[];
  _connectionId: string;
  _connectionStatus: string;
  _connectStack: string;
}

export interface HarExport {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

export interface MessageSelection {
  connectionId: string;
  index: number;
}

export interface MockResponse {
  /** Matches outgoing JSON-RPC/LSP `method` or legacy `action`. */
  match: string;
  response: string;
}

function mockEntryKey(m: MockResponse & { action?: string }): string {
  return normalizeMockAction(m.match ?? m.action ?? "");
}

interface Store {
  connections: Record<string, WsConnection>;
  messages: Record<string, WsMessage[]>;
  selectedConnectionId: string | null;
  searchQuery: string;
  selectedMessage: MessageSelection | null;
  isRecording: boolean;
  mockResponses: Record<string, MockResponse[]>;

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
  addMockResponse: (connectionId: string, mock: MockResponse) => void;
  removeMockResponse: (connectionId: string, matchKey: string) => void;
  /** Clears messages/connections. Pass resetMocks:true on full page navigation to drop mock rules. */
  clearAll: (options?: { resetMocks?: boolean }) => void;
  clearConnectionMessages: (connectionId: string) => void;
  /** Remove connection from the list and drop its mocks/trigger presets (store-backed). */
  removeConnection: (connectionId: string) => void;
  importHar: (har: HarExport) => void;
  exportHar: () => HarExport;
}

export const useStore = create<Store>()((set, get) => ({
  connections: {},
  messages: {},
  selectedConnectionId: null,
  searchQuery: "",
  selectedMessage: null,
  isRecording: false,
  mockResponses: {},

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
            [msgIndex]: { responseIndices: [], waitTimes: [] },
          };
          corrChanged = true;
        } else {
          const requestIndex = newPending[key];
          if (requestIndex != null) {
            const requestMsg = connMsgs[requestIndex];
            if (requestMsg) {
              const waitTime = msg.timestamp - requestMsg.timestamp;
              const existing = connCorr[requestIndex] ?? {
                responseIndices: [],
                waitTimes: [],
              };
              connCorr = {
                ...connCorr,
                [requestIndex]: {
                  responseIndices: [...existing.responseIndices, msgIndex],
                  waitTimes: [...existing.waitTimes, waitTime],
                },
              };
              connRtoR = { ...connRtoR, [msgIndex]: requestIndex };
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

  addMockResponse: (connectionId, mock) =>
    set((state) => {
      const m = mock as MockResponse & { action?: string };
      const match = normalizeMockAction(m.match ?? m.action ?? "");
      if (!match) return state;
      const existing = state.mockResponses[connectionId] ?? [];
      const filtered = existing.filter(
        (m) => mockEntryKey(m) !== match,
      );
      return {
        mockResponses: {
          ...state.mockResponses,
          [connectionId]: [...filtered, { match, response: mock.response }],
        },
      };
    }),

  removeMockResponse: (connectionId, matchKey) =>
    set((state) => {
      const list = state.mockResponses[connectionId];
      if (!list) return state;
      const key = normalizeMockAction(matchKey);
      const next = list.filter((m) => mockEntryKey(m) !== key);
      const newMocks = { ...state.mockResponses };
      if (next.length === 0) delete newMocks[connectionId];
      else newMocks[connectionId] = next;
      return { mockResponses: newMocks };
    }),

  clearAll: (options) =>
    set((state) => ({
      connections: {},
      messages: {},
      selectedConnectionId: null,
      selectedMessage: null,
      pendingRequests: {},
      correlations: {},
      responseToRequest: {},
      mockResponses: options?.resetMocks ? {} : state.mockResponses,
    })),

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
      const newConnections = conn
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
        connections: newConnections,
        correlations: newCorrelations,
        responseToRequest: newRtoR,
        pendingRequests: newPending,
        selectedMessage: newSelectedMessage,
      };
    }),

  removeConnection: (connectionId) =>
    set((state) => {
      if (!state.connections[connectionId]) return state;

      const newConnections = { ...state.connections };
      delete newConnections[connectionId];

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

      const newMocks = { ...state.mockResponses };
      delete newMocks[connectionId];

      const newSelectedMessage =
        state.selectedMessage?.connectionId === connectionId
          ? null
          : state.selectedMessage;

      const newSelectedConnectionId =
        state.selectedConnectionId === connectionId
          ? null
          : state.selectedConnectionId;

      return {
        connections: newConnections,
        messages: newMessages,
        correlations: newCorrelations,
        responseToRequest: newRtoR,
        pendingRequests: newPending,
        mockResponses: newMocks,
        selectedMessage: newSelectedMessage,
        selectedConnectionId: newSelectedConnectionId,
      };
    }),

  importHar: (har) => {
    const connections: Record<string, WsConnection> = {};
    const messages: Record<string, WsMessage[]> = {};
    const correlations: Record<string, Record<number, CorrelationEntry>> = {};
    const responseToRequest: Record<string, Record<number, number>> = {};

    for (const entry of har.log.entries) {
      const connId = entry._connectionId ?? crypto.randomUUID();
      const connMsgs: WsMessage[] = [];
      const connCorr: Record<number, CorrelationEntry> = {};
      const connRtoR: Record<number, number> = {};
      const pending: Record<string, number> = {};

      for (const wsMsg of entry._webSocketMessages) {
        const msg: WsMessage = {
          connectionId: connId,
          direction: wsMsg.type === "send" ? "sent" : "received",
          data: wsMsg.data,
          parsedId: wsMsg._parsedId ?? null,
          stack: wsMsg._stack ?? "",
          timestamp: wsMsg.time * 1000,
        };

        const idx = connMsgs.length;
        connMsgs.push(msg);

        if (msg.parsedId != null) {
          const key = msg.parsedId;
          if (msg.direction === "sent") {
            pending[key] = idx;
            connCorr[idx] = { responseIndices: [], waitTimes: [] };
          } else {
            const reqIdx = pending[key];
            if (reqIdx != null) {
              const waitTime = msg.timestamp - connMsgs[reqIdx]!.timestamp;
              const existing = connCorr[reqIdx] ?? {
                responseIndices: [],
                waitTimes: [],
              };
              connCorr[reqIdx] = {
                responseIndices: [...existing.responseIndices, idx],
                waitTimes: [...existing.waitTimes, waitTime],
              };
              connRtoR[idx] = reqIdx;
            }
          }
        }
      }

      connections[connId] = {
        id: connId,
        url: entry.request.url,
        status:
          (entry._connectionStatus as WsConnection["status"]) ?? "closed",
        connectStack: entry._connectStack ?? "",
        createdAt: new Date(entry.startedDateTime).getTime(),
        messageCount: connMsgs.length,
      };

      messages[connId] = connMsgs;
      if (Object.keys(connCorr).length > 0) correlations[connId] = connCorr;
      if (Object.keys(connRtoR).length > 0)
        responseToRequest[connId] = connRtoR;
    }

    set({
      connections,
      messages,
      correlations,
      responseToRequest,
      pendingRequests: {},
      mockResponses: {},
      selectedConnectionId: null,
      selectedMessage: null,
    });
  },

  exportHar: (): HarExport => {
    const s = get();
    const entries: HarEntry[] = [];

    for (const [connId, conn] of Object.entries(s.connections)) {
      const msgs = s.messages[connId] ?? [];
      entries.push({
        startedDateTime: new Date(conn.createdAt).toISOString(),
        request: {
          method: "GET",
          url: conn.url,
          httpVersion: "HTTP/1.1",
          headers: [],
          queryString: [],
          headersSize: -1,
          bodySize: -1,
        },
        response: {
          status: 101,
          statusText: "Switching Protocols",
          httpVersion: "HTTP/1.1",
          headers: [],
          content: { size: 0, mimeType: "" },
          redirectURL: "",
          headersSize: -1,
          bodySize: -1,
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
        _webSocketMessages: msgs.map((m) => ({
          type: m.direction === "sent" ? ("send" as const) : ("receive" as const),
          time: m.timestamp / 1000,
          opcode: 1,
          data: m.data,
          _parsedId: m.parsedId,
          _stack: m.stack,
        })),
        _connectionId: connId,
        _connectionStatus: conn.status,
        _connectStack: conn.connectStack,
      });
    }

    return {
      log: {
        version: "1.2",
        creator: { name: "WS Logger", version: "1.0.0" },
        entries,
      },
    };
  },
}));
