import { useState, useEffect } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { formatDuration } from "../utils";
import { DataView } from "./JsonTree";

interface StackFrame {
  functionName: string | null;
  url: string;
  line: number;
  column: number;
}

function parseStackFrame(text: string): StackFrame | null {
  const withParens = text.match(
    /^\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/,
  );
  if (withParens) {
    return {
      functionName: withParens[1]!,
      url: withParens[2]!,
      line: parseInt(withParens[3]!, 10),
      column: parseInt(withParens[4]!, 10),
    };
  }
  const bare = text.match(/^\s*at\s+(.+):(\d+):(\d+)\s*$/);
  if (bare) {
    return {
      functionName: null,
      url: bare[1]!,
      line: parseInt(bare[2]!, 10),
      column: parseInt(bare[3]!, 10),
    };
  }
  return null;
}

function extractFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const file = segments[segments.length - 1] || pathname;
    const parent = segments.length > 2 ? segments[segments.length - 2] : null;
    return parent ? `${parent}/${file}` : file;
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1] || url;
  }
}

function openInSources(url: string, line: number, column: number) {
  try {
    chrome.devtools.panels.openResource(url, line - 1, column - 1, () => {});
  } catch {
    // Not in DevTools context
  }
}

function StackTraceView({ stack }: { stack: string }) {
  const lines = stack
    .split("\n")
    .filter((l) => !l.includes("inject.js") && l.trim().length > 0);

  if (lines.length === 0) {
    return (
      <pre className="detail-code stack">No stack trace available</pre>
    );
  }

  return (
    <pre className="detail-code stack">
      {lines.map((line, i) => {
        const frame = parseStackFrame(line);
        if (!frame) {
          return <div key={i}>{line}</div>;
        }
        return (
          <div key={i}>
            {"    at "}
            {frame.functionName && `${frame.functionName} (`}
            <a
              className="stack-link"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openInSources(frame.url, frame.line, frame.column);
              }}
              title={`${frame.url}:${frame.line}:${frame.column}`}
            >
              {extractFilename(frame.url)}:{frame.line}:{frame.column}
            </a>
            {frame.functionName && ")"}
          </div>
        );
      })}
    </pre>
  );
}

function PendingTimer({ sentAt }: { sentAt: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - sentAt);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - sentAt), 100);
    return () => clearInterval(id);
  }, [sentAt]);

  return <span className="pending-timer">{formatDuration(elapsed)}</span>;
}

type DetailTab = "data" | "correlated" | "stack";

export function MessageDetail() {
  const selectedMessage = useStore((s) => s.selectedMessage);
  const selectMessage = useStore((s) => s.selectMessage);
  const message = useStore((s) => {
    if (!s.selectedMessage) return null;
    const msgs = s.messages[s.selectedMessage.connectionId];
    return msgs?.[s.selectedMessage.index] ?? null;
  });

  const { corrType, corrResponseIndex, corrWaitTime, corrData } = useStore(
    useShallow((s) => {
      const nil = {
        corrType: null,
        corrResponseIndex: null,
        corrWaitTime: null,
        corrData: null,
      } as const;
      if (!s.selectedMessage) return nil;

      const { connectionId, index } = s.selectedMessage;
      const connCorr = s.correlations[connectionId];
      const connRtoR = s.responseToRequest[connectionId];
      const connMsgs = s.messages[connectionId];
      if (!connCorr || !connMsgs) return nil;

      const direct = connCorr[index];
      if (direct) {
        const responseMsg =
          direct.responseIndex != null
            ? connMsgs[direct.responseIndex]
            : null;
        return {
          corrType: "request" as const,
          corrResponseIndex: direct.responseIndex,
          corrWaitTime: direct.waitTime,
          corrData: responseMsg?.data ?? null,
        };
      }

      const requestIdx = connRtoR?.[index];
      if (requestIdx != null) {
        const corr = connCorr[requestIdx];
        if (corr) {
          const requestMsg = connMsgs[requestIdx];
          return {
            corrType: "response" as const,
            corrResponseIndex: index,
            corrWaitTime: corr.waitTime,
            corrData: requestMsg?.data ?? null,
          };
        }
      }

      return nil;
    }),
  );

  const [activeTab, setActiveTab] = useState<DetailTab>("data");

  useEffect(() => {
    setActiveTab("data");
  }, [selectedMessage]);

  if (!selectedMessage || !message) {
    return (
      <div className="detail-panel empty">
        <span className="muted">Select a message to view details</span>
      </div>
    );
  }

  const isSent = message.direction === "sent";
  const hasCorrelation = corrType != null;
  const isPending = isSent && hasCorrelation && corrResponseIndex == null;
  const correlatedLabel = isSent ? "Response" : "Request";

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === "data" ? "active" : ""}`}
            onClick={() => setActiveTab("data")}
          >
            Data
          </button>
          {hasCorrelation && (
            <button
              className={`detail-tab ${activeTab === "correlated" ? "active" : ""} ${isPending ? "tab-pending" : ""}`}
              onClick={() => setActiveTab("correlated")}
            >
              {correlatedLabel}
              {isPending && <span className="pending-dot" />}
              {corrWaitTime != null && (
                <span className="tab-wait-time">
                  {formatDuration(corrWaitTime)}
                </span>
              )}
            </button>
          )}
          {
            isSent ? <button
            className={`detail-tab ${activeTab === "stack" ? "active" : ""}`}
            onClick={() => setActiveTab("stack")}
          >
            Stack Trace
          </button> : null
          }
        </div>
        <div className="detail-meta">
          <span className={`direction-badge ${message.direction}`}>
            {isSent ? "REQUEST" : "RESPONSE"}
          </span>
          {message.parsedId != null && (
            <span className="detail-id">ID: {message.parsedId}</span>
          )}
          {corrWaitTime != null && (
            <span className="detail-wait">{formatDuration(corrWaitTime)}</span>
          )}
          {isPending && (
            <span className="detail-pending">
              <span className="spinner small" />
              <PendingTimer sentAt={message.timestamp} />
            </span>
          )}
        </div>
        <button
          className="detail-close"
          onClick={() => selectMessage(null)}
          title="Close"
        >
          x
        </button>
      </div>
      <div className="detail-body">
        {activeTab === "data" && <DataView data={message.data} />}
        {activeTab === "correlated" &&
          (isPending ? (
            <div className="detail-pending-body">
              <span className="spinner large" />
              <span>Waiting for response...</span>
              <PendingTimer sentAt={message.timestamp} />
            </div>
          ) : corrData ? (
            <DataView data={corrData} />
          ) : (
            <div className="detail-pending-body">
              <span className="muted">No correlated message found</span>
            </div>
          ))}
        {activeTab === "stack" && <StackTraceView stack={message.stack} />}
      </div>
    </div>
  );
}
