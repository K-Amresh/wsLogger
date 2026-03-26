import { useEffect } from "react";
import { useStore } from "../store";

export function useChromeConnection() {
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.connect) return;

    const port = chrome.runtime.connect({ name: "ws-logger-panel" });
    const tabId = chrome.devtools.inspectedWindow.tabId;

    port.postMessage({ type: "init", tabId });

    const handleMessage = (msg: Record<string, unknown>) => {
      const store = useStore.getState();
      if (!store.isRecording) return;

      switch (msg.type) {
        case "ws-connect":
          store.addConnection({
            id: msg.connectionId as string,
            url: msg.url as string,
            status: "connecting",
            connectStack: (msg.stack as string) || "",
            createdAt: msg.timestamp as number,
            messageCount: 0,
          });
          break;
        case "ws-open":
          store.updateConnectionStatus(msg.connectionId as string, "open");
          break;
        case "ws-close":
          store.updateConnectionStatus(msg.connectionId as string, "closed");
          break;
        case "ws-error":
          store.updateConnectionStatus(msg.connectionId as string, "error");
          break;
        case "ws-message":
          store.addMessage({
            connectionId: msg.connectionId as string,
            direction: msg.direction as "sent" | "received",
            data: (msg.data as string) || "",
            parsedId: (msg.parsedId as string) ?? null,
            stack: (msg.stack as string) || "",
            timestamp: msg.timestamp as number,
          });
          break;
      }
    };

    port.onMessage.addListener(handleMessage);

    const onNavigated = () => {
      useStore.getState().clearAll();
    };
    chrome.devtools.network.onNavigated.addListener(onNavigated);

    return () => {
      port.disconnect();
      chrome.devtools.network.onNavigated.removeListener(onNavigated);
    };
  }, []);
}
