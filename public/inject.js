(function () {
  const PREFIX = "__WS_LOGGER__";
  const OriginalWebSocket = window.WebSocket;
  let connectionCounter = 0;
  var wsInstances = {};
  var mockConfigs = {};

  function post(data) {
    window.postMessage({ source: PREFIX, ...data }, "*");
  }

  function captureStack() {
    var stack = new Error().stack || "";
    return stack.replace(/^Error\n/, "");
  }

  function normalizeMockKey(s) {
    if (s == null) return "";
    s = String(s).trim();
    if (s.length >= 2) {
      var a = s[0];
      var b = s[s.length - 1];
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
        s = s.slice(1, -1).trim();
      }
    }
    return s;
  }

  function parseJsonLike(raw) {
    if (raw == null) return null;
    if (typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s.length) return null;
    try {
      return JSON.parse(s);
    } catch (e1) {
      try {
        if (s[0] === "{" || s[0] === "[") {
          return new Function("return (" + s + ")")();
        }
      } catch (e2) {}
    }
    return null;
  }

  function tryParseJson(raw) {
    if (typeof raw !== "string") {
      return {
        formatted: String(raw),
        id: null,
        method: null,
        action: null,
      };
    }
    var parsed = parseJsonLike(raw);
    if (parsed === null || typeof parsed !== "object") {
      return {
        formatted: String(raw),
        id: null,
        method: null,
        action: null,
      };
    }
    return {
      formatted: JSON.stringify(parsed, null, 2),
      id: parsed.id ?? null,
      method: parsed.method != null ? String(parsed.method) : null,
      action: parsed.action != null ? String(parsed.action) : null,
    };
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.source !== "__WS_LOGGER_CMD__") return;
    if (event.data.type === "update-mocks") {
      mockConfigs = event.data.mockResponses || {};
    }
    if (event.data.type === "trigger-send") {
      var target = wsInstances[event.data.connectionId];
      if (target && target.readyState === 1) {
        target.send(event.data.payload);
      }
    }
  });

  window.WebSocket = function (url, protocols) {
    const ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    const connectionId = "ws_" + Date.now() + "_" + connectionCounter++;
    const connectStack = captureStack();

    wsInstances[connectionId] = ws;

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
      delete wsInstances[connectionId];
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
      if (event.isTrusted === false) {
        return;
      }
      var raw = event.data;
      var result = tryParseJson(raw);
      post({
        type: "ws-message",
        direction: "received",
        connectionId: connectionId,
        data: result.formatted,
        parsedId: result.id,
        stack: captureStack(),
        timestamp: Date.now(),
      });
    });

    var originalSend = ws.send.bind(ws);
    ws.send = function (msg) {
      var stack = captureStack();
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

      var mocks = mockConfigs[connectionId] || [];
      var reqAction =
        result.action != null ? normalizeMockKey(result.action) : "";
      var reqMethod =
        result.method != null ? normalizeMockKey(result.method) : "";
      var matchKey = reqMethod || reqAction;
      var mock = mocks.find(function (m) {
        var key = normalizeMockKey(m.match || m.action);
        return key && (key === reqAction || key === reqMethod);
      });
      var sendToServer = true;
      if (mock && matchKey) {
        if (mock.sendToServer !== true) {
          sendToServer = false;
        }
      }
      var ret = sendToServer ? originalSend(msg) : undefined;

      if (mock && matchKey) {
        setTimeout(function () {
          try {
            var responseObj = parseJsonLike(mock.response);
            if (responseObj === null || typeof responseObj !== "object") {
              console.warn(
                "[WS Logger] Mock response could not be parsed:",
                mock.response,
              );
              return;
            }
            var fakeData;
            if (Array.isArray(responseObj)) {
              fakeData = JSON.stringify(responseObj);
            } else {
              if (result.id != null) {
                responseObj.id = result.id;
              }
              fakeData = JSON.stringify(responseObj);
            }
            var recvParsed = tryParseJson(fakeData);
            post({
              type: "ws-message",
              direction: "received",
              connectionId: connectionId,
              data: recvParsed.formatted,
              parsedId: recvParsed.id,
              stack: "",
              timestamp: Date.now(),
            });
            ws.dispatchEvent(new MessageEvent("message", { data: fakeData }));
          } catch (e) {
            console.warn("[WS Logger] Mock dispatch failed:", e);
          }
        }, 10);
      }

      return ret;
    };

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
})();
