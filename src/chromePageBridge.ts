import type { MockResponse } from "./store";

let portRef: chrome.runtime.Port | null = null;
let tabIdRef: number | null = null;

export function registerChromePort(port: chrome.runtime.Port, tabId: number) {
  portRef = port;
  tabIdRef = tabId;
}

export function unregisterChromePort() {
  portRef = null;
  tabIdRef = null;
}

export function sendMockResponsesSnapshot(
  mockResponses: Record<string, MockResponse[]>,
) {
  if (!portRef || tabIdRef == null) return;
  portRef.postMessage({
    type: "update-mocks",
    tabId: tabIdRef,
    mockResponses,
  });
}

export function sendTriggerSend(connectionId: string, payload: string) {
  if (!portRef || tabIdRef == null) return;
  portRef.postMessage({
    type: "trigger-send",
    tabId: tabIdRef,
    connectionId,
    payload,
  });
}

export function sendStackTraceLimitSnapshot(stackTraceLimit: number) {
  if (!portRef || tabIdRef == null) return;
  portRef.postMessage({
    type: "update-stack-trace-limit",
    tabId: tabIdRef,
    stackTraceLimit,
  });
}
