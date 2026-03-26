(function () {
  const PREFIX = "__WS_LOGGER__";
  const OriginalWebSocket = window.WebSocket;
  let connectionCounter = 0;

  function post(data) {
    window.postMessage({ source: PREFIX, ...data }, "*");
  }

  function tryParseJson(raw) {
    try {
      const parsed = JSON.parse(raw);
      return { formatted: JSON.stringify(parsed, null, 2), id: parsed.id ?? null };
    } catch {
      return { formatted: String(raw), id: null };
    }
  }

  window.WebSocket = function (url, protocols) {
    const ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    const connectionId = "ws_" + Date.now() + "_" + connectionCounter++;
    const connectStack = new Error().stack || "";

    post({
      type: "ws-connect",
      connectionId: connectionId,
      url: url,
      stack: connectStack,
      timestamp: Date.now(),
    });

    ws.addEventListener("open", function () {
      post({ type: "ws-open", connectionId: connectionId, timestamp: Date.now() });
    });

    ws.addEventListener("close", function (event) {
      post({
        type: "ws-close",
        connectionId: connectionId,
        code: event.code,
        reason: event.reason,
        timestamp: Date.now(),
      });
    });

    ws.addEventListener("error", function () {
      post({ type: "ws-error", connectionId: connectionId, timestamp: Date.now() });
    });

    ws.addEventListener("message", function (event) {
      var raw = event.data;
      var result = tryParseJson(raw);
      post({
        type: "ws-message",
        direction: "received",
        connectionId: connectionId,
        data: result.formatted,
        parsedId: result.id,
        stack: new Error().stack || "",
        timestamp: Date.now(),
      });
    });

    var originalSend = ws.send.bind(ws);
    ws.send = function (msg) {
      var stack = new Error().stack || "";
      var result = tryParseJson(msg);
      post({
        type: "ws-message",
        direction: "sent",
        connectionId: connectionId,
        data: result.formatted,
        parsedId: result.id,
        stack: stack,
        timestamp: Date.now(),
      });
      return originalSend(msg);
    };

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
})();
