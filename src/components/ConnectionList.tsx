import { useStore } from "../store";

const STATUS_COLORS: Record<string, string> = {
  connecting: "var(--status-connecting)",
  open: "var(--status-open)",
  closed: "var(--status-closed)",
  error: "var(--status-error)",
};

function extractPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname !== "/" ? u.pathname : u.host;
  } catch {
    return url;
  }
}

export function ConnectionList() {
  const connections = useStore((s) => s.connections);
  const selectedId = useStore((s) => s.selectedConnectionId);
  const selectConnection = useStore((s) => s.selectConnection);
  const clearConnectionMessages = useStore(
    (s) => s.clearConnectionMessages,
  );
  const removeConnection = useStore((s) => s.removeConnection);

  const entries = Object.values(connections).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <div className="connection-list-panel">
      <div className="sidebar-header">
        <span>Connections</span>
        {selectedId && (
          <button
            className="sidebar-clear-btn"
            onClick={() => selectConnection(null)}
            title="Show all"
          >
            Show All
          </button>
        )}
      </div>
      <div className="sidebar-list">
        {entries.length === 0 && (
          <div className="sidebar-empty">
            No WebSocket connections detected.
            <br />
            <span className="muted">
              Reload the inspected page to start capturing.
            </span>
          </div>
        )}
        {entries.map((conn) => (
          <div
            key={conn.id}
            className={`connection-item ${selectedId === conn.id ? "selected" : ""}`}
            onClick={() =>
              selectConnection(selectedId === conn.id ? null : conn.id)
            }
          >
            <span
              className="status-dot"
              style={{ background: STATUS_COLORS[conn.status] ?? "#888" }}
              title={conn.status}
            />
            <div className="connection-info">
              <span className="connection-url" title={conn.url}>
                {extractPath(conn.url)}
              </span>
              <span className="connection-meta">
                {conn.status} &middot; {conn.messageCount} msgs
              </span>
            </div>
            <div className="conn-item-actions">
              {conn.messageCount > 0 && (
                <button
                  className="conn-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearConnectionMessages(conn.id);
                  }}
                  title="Clear messages for this connection"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                    <path
                      fillRule="evenodd"
                      d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                    />
                  </svg>
                </button>
              )}
              <button
                className="conn-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeConnection(conn.id);
                }}
                title="Remove connection (clears its mocks)"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.15 9.15a.5.5 0 0 1-.7.7L8 8.71l-2.45 2.14a.5.5 0 0 1-.7-.7L7.29 8 4.85 5.55a.5.5 0 0 1 .7-.7L8 7.29l2.45-2.44a.5.5 0 0 1 .7.7L8.71 8l2.44 2.15z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
