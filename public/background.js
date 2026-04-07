const devtoolsPorts = new Map();
const messageBuffer = new Map();
const MAX_BUFFER = 2000;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ws-logger-panel") return;

  let connectedTabId = null;

  port.onMessage.addListener((msg) => {
    if (msg.type === "init") {
      const tabId = msg.tabId;
      connectedTabId = tabId;
      devtoolsPorts.set(tabId, port);

      const buffer = messageBuffer.get(tabId) || [];
      buffer.forEach((m) => port.postMessage(m));
      messageBuffer.delete(tabId);

      port.onDisconnect.addListener(() => {
        devtoolsPorts.delete(tabId);
      });
    }

    if (msg.type === "update-mocks" && connectedTabId != null) {
      chrome.tabs
        .sendMessage(connectedTabId, {
          source: "__WS_LOGGER_CMD__",
          type: "update-mocks",
          mockResponses: msg.mockResponses,
        })
        .catch(() => {});
    }

    if (msg.type === "trigger-send" && connectedTabId != null) {
      chrome.tabs
        .sendMessage(connectedTabId, {
          source: "__WS_LOGGER_CMD__",
          type: "trigger-send",
          connectionId: msg.connectionId,
          payload: msg.payload,
        })
        .catch(() => {});
    }

    if (msg.type === "update-stack-trace-limit" && connectedTabId != null) {
      chrome.tabs
        .sendMessage(connectedTabId, {
          source: "__WS_LOGGER_CMD__",
          type: "update-stack-trace-limit",
          stackTraceLimit: msg.stackTraceLimit,
        })
        .catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.source !== "__WS_LOGGER__") return;

  const tabId = sender.tab?.id;
  if (tabId == null) return;

  const port = devtoolsPorts.get(tabId);
  if (port) {
    port.postMessage(message);
  } else {
    if (!messageBuffer.has(tabId)) messageBuffer.set(tabId, []);
    const buffer = messageBuffer.get(tabId);
    buffer.push(message);
    if (buffer.length > MAX_BUFFER) buffer.shift();
  }
});
