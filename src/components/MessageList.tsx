import { useMemo, useRef, useEffect, useState } from "react";
import { useStore } from "../store";
import type { MessageSelection } from "../store";
import { formatDuration } from "../utils";
import type { MessageFilter, WsMessage } from "../types";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const base = d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${base}.${ms}`;
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "..." : oneLine;
}

const FILTERS: { key: MessageFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Requests" },
  { key: "received", label: "Responses" },
];

type FlatMessage = WsMessage & { sel: MessageSelection };

export function MessageList() {
  const messagesMap = useStore((s) => s.messages);
  const connections = useStore((s) => s.connections);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const searchQuery = useStore((s) => s.searchQuery);
  const selectedMessage = useStore((s) => s.selectedMessage);
  const selectMessage = useStore((s) => s.selectMessage);
  const correlations = useStore((s) => s.correlations);
  const clearAll = useStore((s) => s.clearAll);
  const clearConnectionMessages = useStore((s) => s.clearConnectionMessages);

  const [filter, setFilter] = useState<MessageFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFilter("all");
    selectMessage(null);
  }, [selectedConnectionId, selectMessage]);

  const flat = useMemo(() => {
    const result: FlatMessage[] = [];

    const addMessages = (connId: string, msgs: WsMessage[]) => {
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i]!;
        result.push(Object.assign({}, m, { sel: { connectionId: connId, index: i } }));
      }
    };

    if (selectedConnectionId) {
      addMessages(selectedConnectionId, messagesMap[selectedConnectionId] ?? []);
    } else {
      for (const [connId, msgs] of Object.entries(messagesMap)) {
        if (!(connId in connections)) continue;
        addMessages(connId, msgs);
      }
      result.sort((a, b) => a.timestamp - b.timestamp);
    }

    return result;
  }, [messagesMap, connections, selectedConnectionId]);

  const filtered = useMemo(() => {
    let result = flat;

    if (filter !== "all") {
      result = result.filter((m) => m.direction === filter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.data.toLowerCase().includes(q) ||
          (m.parsedId != null && String(m.parsedId).includes(q)),
      );
    }
    return result;
  }, [flat, filter, searchQuery]);

  const totalMessages = flat.length;

  const isSelected = (sel: MessageSelection) =>
    selectedMessage != null &&
    selectedMessage.connectionId === sel.connectionId &&
    selectedMessage.index === sel.index;

  return (
    <div className="message-panel">
      <div className="message-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`message-tab ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="tab-count">
              {f.key === "all"
                ? filtered.length
                : flat.filter((m) => m.direction === f.key).length}
            </span>
          </button>
        ))}
        <button
          className="toolbar-btn message-tabs-clear"
          onClick={() =>
            selectedConnectionId
              ? clearConnectionMessages(selectedConnectionId)
              : clearAll()
          }
          title={
            selectedConnectionId
              ? "Clear messages for this connection"
              : "Clear all messages"
          }
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.15 9.15a.5.5 0 0 1-.7.7L8 8.71l-2.45 2.14a.5.5 0 0 1-.7-.7L7.29 8 4.85 5.55a.5.5 0 0 1 .7-.7L8 7.29l2.45-2.44a.5.5 0 0 1 .7.7L8.71 8l2.44 2.15z" />
          </svg>
        </button>
      </div>
      <div className="message-list" ref={listRef}>
        {filtered.length === 0 && (
          <div className="message-empty">
            {totalMessages === 0
              ? "Waiting for WebSocket messages..."
              : "No messages match the current filter."}
          </div>
        )}
        {filtered.map((msg) => {
          const corr =
            msg.direction === "sent"
              ? correlations[msg.sel.connectionId]?.[msg.sel.index]
              : undefined;

          return (
            <div
              key={`${msg.sel.connectionId}:${msg.sel.index}`}
              className={`message-row ${msg.direction} ${isSelected(msg.sel) ? "selected" : ""}`}
              onClick={() =>
                selectMessage(isSelected(msg.sel) ? null : msg.sel)
              }
            >
              <span className={`direction-icon ${msg.direction}`}>
                {msg.direction === "sent" ? "\u2191" : "\u2193"}
              </span>
              <span className="message-preview">
                {truncate(msg.data, 120)}
              </span>
              {corr &&
                (corr.responseIndices.length === 0 ? (
                  <span
                    className="pending-badge"
                    title="Waiting for response"
                  >
                    <span className="spinner small" />
                  </span>
                ) : (
                  <span className="wait-badge" title="Response time">
                    {formatDuration(corr.waitTimes[0] ?? 0)}
                    {corr.responseIndices.length > 1 && (
                      <span className="response-count">
                        {" "}({corr.responseIndices.length})
                      </span>
                    )}
                  </span>
                ))}
              <span className="message-time">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
