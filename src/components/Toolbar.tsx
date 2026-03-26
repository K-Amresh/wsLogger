import { useStore } from "../store";

export function Toolbar() {
  const isRecording = useStore((s) => s.isRecording);
  const setRecording = useStore((s) => s.setRecording);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const connectionCount = useStore(
    (s) => Object.values(s.connections).filter((c) => c.status === "open").length,
  );
  const totalMessages = useStore((s) =>
    Object.values(s.messages).reduce((sum, msgs) => sum + msgs.length, 0),
  );

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
        <span className="toolbar-stat">
          {connectionCount} active
        </span>
        <span className="toolbar-stat muted">
          {totalMessages} messages
        </span>
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
