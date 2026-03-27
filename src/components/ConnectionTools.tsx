import { useCallback, useState } from "react";
import { useStore, type MockResponse } from "../store";
import { sendTriggerSend } from "../chromePageBridge";
import { normalizeMockAction } from "../utils";

function newRowId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface TriggerRow {
  id: string;
  payload: string;
}

export function ConnectionTools() {
  const selectedId = useStore((s) => s.selectedConnectionId);
  const connections = useStore((s) => s.connections);
  const mockResponses = useStore((s) => s.mockResponses);
  const addMockResponse = useStore((s) => s.addMockResponse);
  const removeMockResponse = useStore((s) => s.removeMockResponse);

  const [triggerRows, setTriggerRows] = useState<TriggerRow[]>([
    { id: newRowId(), payload: "{}" },
  ]);
  const [newMatch, setNewMatch] = useState("");
  const [newResponse, setNewResponse] = useState("{}");

  const updateRowPayload = useCallback((rowId: string, payload: string) => {
    setTriggerRows((rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, payload } : r)),
    );
  }, []);

  const addTriggerRow = useCallback(() => {
    setTriggerRows((rows) => [...rows, { id: newRowId(), payload: "{}" }]);
  }, []);

  const removeTriggerRow = useCallback((rowId: string) => {
    setTriggerRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.id !== rowId),
    );
  }, []);

  if (!selectedId) {
    return null;
  }

  const conn = connections[selectedId];
  const mocks = mockResponses[selectedId] ?? [];
  const canSend = conn?.status === "open";

  const handleTrigger = (payload: string) => {
    sendTriggerSend(selectedId, payload);
  };

  const handleAddMock = () => {
    const match = newMatch.trim();
    if (!match) return;
    addMockResponse(selectedId, { match, response: newResponse });
    setNewMatch("");
    setNewResponse("{}");
  };

  return (
    <div className="connection-tools">
      <div className="connection-tools-header">Tools</div>

      <div className="trigger-section">
        <div className="connection-tools-subtitle">Trigger</div>
        <p className="connection-tools-hint">
          Send a payload through this WebSocket (same as{" "}
          <code>ws.send</code> from your app). Add multiple rows for quick
          presets. Use JSON or JS-style objects with <code>method</code> or{" "}
          <code>action</code> when needed.
        </p>
        <div className="trigger-rows">
          {triggerRows.map((row) => (
            <div key={row.id} className="trigger-row">
              <textarea
                className="trigger-input"
                value={row.payload}
                onChange={(e) => updateRowPayload(row.id, e.target.value)}
                spellCheck={false}
                rows={3}
                placeholder='{"action":"foo"}'
              />
              <div className="trigger-row-actions">
                <button
                  type="button"
                  className="trigger-btn"
                  disabled={!canSend}
                  onClick={() => handleTrigger(row.payload)}
                >
                  Trigger
                </button>
                {triggerRows.length > 1 && (
                  <button
                    type="button"
                    className="trigger-row-remove"
                    onClick={() => removeTriggerRow(row.id)}
                    title="Remove row"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="trigger-add-row"
          onClick={addTriggerRow}
        >
          + Add trigger row
        </button>
      </div>

      <div className="mock-section">
        <div className="connection-tools-subtitle">Mock responses</div>
        <p className="connection-tools-hint">
          When an outgoing JSON message’s <code>method</code> or{" "}
          <code>action</code> matches a saved key (from your app or Trigger), a
          synthetic <code>message</code> is logged and dispatched; the response
          object is merged with the request <code>id</code> when present.
        </p>
        {mocks.length === 0 && (
          <p className="connection-tools-hint mock-empty-hint">
            No mocks saved yet — enter method (or action) + response, then click{" "}
            <strong>Add mock</strong>.
          </p>
        )}
        {mocks.map((m: MockResponse & { action?: string }) => {
          const label = m.match ?? m.action ?? "";
          const rowKey = normalizeMockAction(label) || label;
          return (
            <div key={rowKey} className="mock-row">
              <div className="mock-row-fields">
                <span className="mock-action-label">{label}</span>
                <pre className="mock-response-preview">{m.response}</pre>
              </div>
              <button
                type="button"
                className="mock-remove-btn"
                onClick={() => removeMockResponse(selectedId, label)}
                title="Remove"
              >
                x
              </button>
            </div>
          );
        })}
        <div className="mock-add-form">
          <input
            className="mock-action-input"
            placeholder="method or action"
            value={newMatch}
            onChange={(e) => setNewMatch(e.target.value)}
          />
          <textarea
            className="mock-response-input"
            placeholder='Response JSON (e.g. {"action":"","payload":{}})'
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
            spellCheck={false}
            rows={3}
          />
          <button
            type="button"
            className="mock-add-btn"
            disabled={!newMatch.trim()}
            onClick={handleAddMock}
          >
            Add mock
          </button>
        </div>
      </div>
    </div>
  );
}
