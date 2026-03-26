import { useState, useEffect, useMemo } from "react";
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

interface CorrResponse {
  data: string;
  waitTime: number;
}

export function MessageDetail() {
  const selectedMessage = useStore((s) => s.selectedMessage);
  const selectMessage = useStore((s) => s.selectMessage);
  const message = useStore((s) => {
    if (!s.selectedMessage) return null;
    const msgs = s.messages[s.selectedMessage.connectionId];
    return msgs?.[s.selectedMessage.index] ?? null;
  });

  const connectionUrl = useStore((s) => {
    if (!s.selectedMessage) return null;
    return s.connections[s.selectedMessage.connectionId]?.url ?? null;
  });

  const {
    corrType,
    corrIsPending,
    corrFirstWaitTime,
    corrResponseCount,
    corrResponsesJson,
    corrRequestData,
  } = useStore(
    useShallow((s) => {
      const nil = {
        corrType: null,
        corrIsPending: false,
        corrFirstWaitTime: null,
        corrResponseCount: 0,
        corrResponsesJson: "[]",
        corrRequestData: null,
      } as const;
      if (!s.selectedMessage) return nil;

      const { connectionId, index } = s.selectedMessage;
      const connCorr = s.correlations[connectionId];
      const connRtoR = s.responseToRequest[connectionId];
      const connMsgs = s.messages[connectionId];
      if (!connCorr || !connMsgs) return nil;

      const direct = connCorr[index];
      if (direct) {
        const responses = direct.responseIndices.map((ri, i) => ({
          data: connMsgs[ri]?.data ?? "",
          waitTime: direct.waitTimes[i] ?? 0,
        }));
        return {
          corrType: "request" as const,
          corrIsPending: direct.responseIndices.length === 0,
          corrFirstWaitTime: direct.waitTimes[0] ?? null,
          corrResponseCount: direct.responseIndices.length,
          corrResponsesJson: JSON.stringify(responses),
          corrRequestData: null,
        };
      }

      const requestIdx = connRtoR?.[index];
      if (requestIdx != null) {
        const corr = connCorr[requestIdx];
        if (corr) {
          const requestMsg = connMsgs[requestIdx];
          return {
            corrType: "response" as const,
            corrIsPending: false,
            corrFirstWaitTime: corr.waitTimes[0] ?? null,
            corrResponseCount: 0,
            corrResponsesJson: "[]",
            corrRequestData: requestMsg?.data ?? null,
          };
        }
      }

      return nil;
    }),
  );

  const corrResponses = useMemo<CorrResponse[]>(
    () => JSON.parse(corrResponsesJson),
    [corrResponsesJson],
  );

  const [activeTab, setActiveTab] = useState<DetailTab>("data");
  const [activeResponseIdx, setActiveResponseIdx] = useState(0);

  useEffect(() => {
    setActiveTab("data");
    setActiveResponseIdx(0);
  }, [selectedMessage]);

  useEffect(() => {
    if (activeResponseIdx >= corrResponses.length && corrResponses.length > 0) {
      setActiveResponseIdx(corrResponses.length - 1);
    }
  }, [corrResponses.length, activeResponseIdx]);

  if (!selectedMessage || !message) {
    return (
      <div className="detail-panel empty">
        <span className="muted">Select a message to view details</span>
      </div>
    );
  }

  const isSent = message.direction === "sent";
  const hasCorrelation = corrType != null;
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
              className={`detail-tab ${activeTab === "correlated" ? "active" : ""} ${corrIsPending ? "tab-pending" : ""}`}
              onClick={() => setActiveTab("correlated")}
            >
              {correlatedLabel}
              {corrIsPending && <span className="pending-dot" />}
              {corrFirstWaitTime != null && (
                <span className="tab-wait-time">
                  {formatDuration(corrFirstWaitTime)}
                </span>
              )}
              {corrResponseCount > 1 && (
                <span className="tab-wait-time">
                  ({corrResponseCount})
                </span>
              )}
            </button>
          )}
          {isSent ? (
            <button
              className={`detail-tab ${activeTab === "stack" ? "active" : ""}`}
              onClick={() => setActiveTab("stack")}
            >
              Stack Trace
            </button>
          ) : null}
        </div>
        <div className="detail-meta">
          <span className={`direction-badge ${message.direction}`}>
            {isSent ? "REQUEST" : "RESPONSE"}
          </span>
          {message.parsedId != null && (
            <span className="detail-id">ID: {message.parsedId}</span>
          )}
          {corrFirstWaitTime != null && (
            <span className="detail-wait">
              {formatDuration(corrFirstWaitTime)}
            </span>
          )}
          {corrIsPending && (
            <span className="detail-pending">
              <span className="spinner small" />
              <PendingTimer sentAt={message.timestamp} />
            </span>
          )}
          {connectionUrl && (
            <span className="detail-url" title={connectionUrl}>
              {connectionUrl}
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
        {activeTab === "correlated" && (
          <>
            {corrIsPending ? (
              <div className="detail-pending-body">
                <span className="spinner large" />
                <span>Waiting for response...</span>
                <PendingTimer sentAt={message.timestamp} />
              </div>
            ) : corrType === "request" ? (
              corrResponses.length === 0 ? (
                <div className="detail-pending-body">
                  <span className="muted">No correlated message found</span>
                </div>
              ) : (
                <>
                  {corrResponses.length > 1 && (
                    <div className="response-subtabs">
                      {corrResponses.map((r, i) => (
                        <button
                          key={i}
                          className={`response-subtab ${activeResponseIdx === i ? "active" : ""}`}
                          onClick={() => setActiveResponseIdx(i)}
                        >
                          Response {i + 1}
                          <span className="subtab-time">
                            {formatDuration(r.waitTime)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <DataView
                    data={corrResponses[activeResponseIdx]?.data ?? ""}
                  />
                </>
              )
            ) : corrRequestData ? (
              <DataView data={corrRequestData} />
            ) : (
              <div className="detail-pending-body">
                <span className="muted">No correlated message found</span>
              </div>
            )}
          </>
        )}
        {activeTab === "stack" && <StackTraceView stack={message.stack} />}
      </div>
    </div>
  );
}
