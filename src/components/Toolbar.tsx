import { useRef } from "react";
import { useStore } from "../store";
import type { HarExport } from "../store";
import { STACK_TRACE_LIMIT_MAX } from "../utils";

function downloadHar(data: HarExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `ws-logger-${ts}.har`;
  a.click();
  URL.revokeObjectURL(url);
}

function validateHar(data: unknown): data is HarExport {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.log || typeof d.log !== "object") return false;
  const log = d.log as Record<string, unknown>;
  return typeof log.version === "string" && Array.isArray(log.entries);
}

export function Toolbar() {
  const isRecording = useStore((s) => s.isRecording);
  const setRecording = useStore((s) => s.setRecording);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const connectionCount = useStore(
    (s) =>
      Object.values(s.connections).filter((c) => c.status === "open").length,
  );
  const totalMessages = useStore((s) =>
    Object.values(s.messages).reduce((sum, msgs) => sum + msgs.length, 0),
  );
  const exportHar = useStore((s) => s.exportHar);
  const importHar = useStore((s) => s.importHar);
  const stackTraceLimit = useStore((s) => s.stackTraceLimit);
  const setStackTraceLimit = useStore((s) => s.setStackTraceLimit);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportHar();
    downloadHar(data);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!validateHar(parsed)) {
          alert("Invalid HAR file.");
          return;
        }
        importHar(parsed);
      } catch {
        alert("Failed to parse HAR file.");
      }
    };
    reader.readAsText(file);

    e.target.value = "";
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className={`toolbar-btn ${isRecording ? "recording" : ""}`}
          onClick={() => setRecording(!isRecording)}
          title={isRecording ? "Pause recording" : "Resume recording"}
        >
          {isRecording ? (
            <span className="record-dot" />
          ) : (
            <span className="record-paused">▐▐</span>
          )}
        </button>
        <span className="toolbar-separator" />
        <span className="toolbar-stat">{connectionCount} active</span>
        <span className="toolbar-stat muted">{totalMessages} messages</span>
        <span className="toolbar-separator" />
        <label
          className="toolbar-stack-depth-label"
          title="Error.stackTraceLimit in the inspected page: number of stack frames captured for WebSocket stack traces (1–200)."
        >
          <span className="toolbar-stack-depth-text">Frames</span>
          <input
            type="number"
            className="toolbar-stack-depth-input"
            min={1}
            max={STACK_TRACE_LIMIT_MAX}
            step={1}
            value={stackTraceLimit}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setStackTraceLimit(10);
                return;
              }
              const v = parseInt(raw, 10);
              setStackTraceLimit(Number.isNaN(v) ? 10 : v);
            }}
            aria-label="Stack trace frame limit (Error.stackTraceLimit)"
          />
        </label>
        <span className="toolbar-separator" />
        <button
          className="toolbar-btn"
          onClick={handleExport}
          title="Export messages"
          disabled={totalMessages === 0}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
            <path d="M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z" />
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={handleImport}
          title="Import messages"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
            <path d="M7.646 4.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707V14.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3z" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".har,.json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
      <div className="toolbar-right">
        <div className="search-wrapper">
          <svg
            className="search-icon"
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Filter messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery("")}
            >
              x
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
