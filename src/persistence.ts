import type { MockResponse } from "./store";
import { clampStackTraceLimit } from "./utils";

const LS_MOCKS_BY_URL = "wsLogger.mocksByUrl";
const LS_TRIGGER_PAYLOADS = "wsLogger.triggerPayloads";
const LS_STACK_TRACE_LIMIT = "wsLogger.stackTraceLimit";

export function normalizeWsUrlKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url.trim();
  }
}

function safeParseMocksRecord(raw: string | null): Record<string, MockResponse[]> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== "object" || p === null || Array.isArray(p)) return {};
    const out: Record<string, MockResponse[]> = {};
    for (const [k, v] of Object.entries(p)) {
      if (!Array.isArray(v)) continue;
      out[k] = v.filter(
        (m): m is MockResponse =>
          m != null &&
          typeof m === "object" &&
          typeof (m as MockResponse).match === "string" &&
          typeof (m as MockResponse).response === "string",
      );
    }
    return out;
  } catch {
    return {};
  }
}

export function loadMocksByUrlRecord(): Record<string, MockResponse[]> {
  if (typeof localStorage === "undefined") return {};
  try {
    return safeParseMocksRecord(localStorage.getItem(LS_MOCKS_BY_URL));
  } catch {
    return {};
  }
}

export function getPersistedMocksForUrl(url: string): MockResponse[] {
  const key = normalizeWsUrlKey(url);
  return loadMocksByUrlRecord()[key] ?? [];
}

export function clearPersistedMocks(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LS_MOCKS_BY_URL);
  } catch {
    /* ignore quota */
  }
}

/** Merge current connections + mockResponses into LS (by URL). Preserves URLs not currently connected. */
export function persistMockResponsesFromState(state: {
  connections: Record<string, { url: string }>;
  mockResponses: Record<string, MockResponse[]>;
}): void {
  if (typeof localStorage === "undefined") return;
  try {
    const byUrl = loadMocksByUrlRecord();
    for (const connId of Object.keys(state.connections)) {
      const conn = state.connections[connId];
      if (!conn?.url) continue;
      if (!Object.prototype.hasOwnProperty.call(state.mockResponses, connId)) {
        continue;
      }
      const key = normalizeWsUrlKey(conn.url);
      const mocks = state.mockResponses[connId];
      if (mocks && mocks.length > 0) {
        byUrl[key] = mocks.map((m) => ({
          match: m.match,
          response: m.response,
          sendToServer: m.sendToServer !== false,
        }));
      } else {
        delete byUrl[key];
      }
    }
    localStorage.setItem(LS_MOCKS_BY_URL, JSON.stringify(byUrl));
  } catch {
    /* ignore quota */
  }
}

export function loadTriggerPayloads(): string[] {
  if (typeof localStorage === "undefined") return ["{}"];
  try {
    const raw = localStorage.getItem(LS_TRIGGER_PAYLOADS);
    if (!raw) return ["{}"];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p) || p.length === 0) return ["{}"];
    return p.map((x) => (typeof x === "string" ? x : "{}"));
  } catch {
    return ["{}"];
  }
}

export function saveTriggerPayloads(payloads: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_TRIGGER_PAYLOADS, JSON.stringify(payloads));
  } catch {
    /* ignore quota */
  }
}

/** Toolbar "Frames" value (`Error.stackTraceLimit`); null if unset or invalid. */
export function loadPersistedStackTraceLimit(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_STACK_TRACE_LIMIT);
    if (raw == null || raw === "") return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    return clampStackTraceLimit(n);
  } catch {
    return null;
  }
}

export function savePersistedStackTraceLimit(limit: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      LS_STACK_TRACE_LIMIT,
      String(clampStackTraceLimit(limit)),
    );
  } catch {
    /* ignore quota */
  }
}
