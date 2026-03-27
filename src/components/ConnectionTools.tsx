import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useStore, type MockResponse } from "../store";
import { sendTriggerSend } from "../chromePageBridge";
import { normalizeMockAction } from "../utils";

function InfoTooltip({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      hideTimer.current = null;
    }, 150);
  }, [clearHide]);

  const show = useCallback(() => {
    clearHide();
    setOpen(true);
  }, [clearHide]);

  useEffect(() => () => clearHide(), [clearHide]);

  const updatePosition = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !tip) return;
    const pad = 8;
    const br = wrap.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let top = br.top - tr.height - pad;
    if (top < pad) {
      top = br.bottom + pad;
    }
    let left = br.left;
    if (left + tr.width > window.innerWidth - pad) {
      left = window.innerWidth - tr.width - pad;
    }
    if (left < pad) left = pad;
    if (top + tr.height > window.innerHeight - pad) {
      top = Math.max(pad, br.top - tr.height - pad);
    }
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, children]);

  useLayoutEffect(() => {
    if (!open) return;
    const tip = tooltipRef.current;
    if (!tip) return;
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(tip);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const onWrapMouseLeave = useCallback(() => {
    const wrap = wrapRef.current;
    if (wrap?.contains(document.activeElement)) return;
    scheduleHide();
  }, [scheduleHide]);

  return (
    <>
      <span
        ref={wrapRef}
        className="connection-tools-info-wrap"
        onMouseEnter={show}
        onMouseLeave={onWrapMouseLeave}
      >
        <button
          type="button"
          className="connection-tools-info-btn"
          aria-label={label}
          aria-describedby={open ? id : undefined}
          onFocus={show}
          onBlur={scheduleHide}
        >
          <svg
            className="connection-tools-info-icon"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <line
              x1="12"
              y1="16"
              x2="12"
              y2="11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="8" r="1.25" fill="currentColor" />
          </svg>
        </button>
      </span>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className="connection-tools-tooltip connection-tools-tooltip-portal"
            style={
              coords
                ? { top: coords.top, left: coords.left, opacity: 1 }
                : { top: 0, left: 0, opacity: 0, pointerEvents: "none" }
            }
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

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
  const toggleMockSendToServer = useStore((s) => s.toggleMockSendToServer);
  const addMockResponse = useStore((s) => s.addMockResponse);
  const updateMockResponse = useStore((s) => s.updateMockResponse);
  const removeMockResponse = useStore((s) => s.removeMockResponse);

  const [triggerRows, setTriggerRows] = useState<TriggerRow[]>([
    { id: newRowId(), payload: "{}" },
  ]);
  const [newMatch, setNewMatch] = useState("");
  const [newResponse, setNewResponse] = useState("{}");

  const [editingMock, setEditingMock] = useState<{ prevLabel: string } | null>(
    null,
  );
  const [draftMatch, setDraftMatch] = useState("");
  const [draftResponse, setDraftResponse] = useState("");

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

  const startEditMock = useCallback((label: string, response: string) => {
    setEditingMock({ prevLabel: label });
    setDraftMatch(label);
    setDraftResponse(response);
  }, []);

  const cancelEditMock = useCallback(() => {
    setEditingMock(null);
    setDraftMatch("");
    setDraftResponse("");
  }, []);

  const saveEditMock = useCallback(() => {
    if (!editingMock || !selectedId) return;
    const match = draftMatch.trim();
    if (!match) return;
    const ok = updateMockResponse(selectedId, editingMock.prevLabel, {
      match,
      response: draftResponse,
    });
    if (ok) cancelEditMock();
  }, [
    editingMock,
    draftMatch,
    draftResponse,
    selectedId,
    updateMockResponse,
    cancelEditMock,
  ]);

  if (!selectedId) {
    return null;
  }

  const conn = connections[selectedId];
  const mocks = mockResponses[selectedId] ?? [];
  const canSend = conn?.status === "open";

  const mockSendThroughTitle =
    "Mock + server send for this row: green = matching requests are still sent to the server (mock response is also applied locally). Red (default) = matching requests are not sent to the server; only the mock response is delivered.";
  const mockSendThroughAria =
    "Toggle server send for this mock: green sends matching requests to the server; red (default) skips the real send and only applies the mock.";

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
        <div className="connection-tools-subtitle-row">
          <span className="connection-tools-subtitle">Trigger</span>
          <InfoTooltip id="trigger-help" label="About Trigger">
            Send a payload through this WebSocket (same as <code>ws.send</code> from
            your app). Add multiple rows for quick presets. Use JSON or JS-style
            objects with <code>method</code> or <code>action</code> when needed.
          </InfoTooltip>
        </div>
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
        <div className="connection-tools-subtitle-row">
          <span className="connection-tools-subtitle">Mock responses</span>
          <InfoTooltip id="mock-help" label="About mock responses">
            When an outgoing JSON message’s <code>method</code> or{" "}
            <code>action</code> matches a saved key (from your app or Trigger), a
            synthetic <code>message</code> is logged and dispatched; the response
            object is merged with the request <code>id</code> when present. Add a
            row: enter method (or action) and response JSON, then{" "}
            <strong>Add mock</strong>. Use <strong>Edit</strong> on a saved row to
            change it. Each row has a red/green dot: green sends matching requests
            to the server as well; red (default) skips the real send for that
            rule.
          </InfoTooltip>
        </div>
        {mocks.length === 0 && (
          <p className="mock-empty-hint">No mocks yet.</p>
        )}
        <div className="mock-rows">
          {mocks.map((m: MockResponse & { action?: string }) => {
            const label = m.match ?? m.action ?? "";
            const rowKey = normalizeMockAction(label) || label;
            const sendThrough = m.sendToServer === true;
            const isEditing =
              editingMock !== null && editingMock.prevLabel === label;
            const showMatch = isEditing ? draftMatch : label;
            const showResponse = isEditing ? draftResponse : m.response;
            return (
              <div
                key={rowKey}
                className={`trigger-row mock-row-saved ${isEditing ? "mock-row-saved-editing" : ""}`}
              >
                <div className="mock-row-stack">
                  <input
                    type="text"
                    className={`mock-match-input ${!isEditing ? "mock-match-input-readonly" : ""}`}
                    value={showMatch}
                    readOnly={!isEditing}
                    onChange={(e) => setDraftMatch(e.target.value)}
                    placeholder="method or action"
                    spellCheck={false}
                  />
                  <textarea
                    className={`trigger-input mock-response-textarea ${!isEditing ? "mock-response-textarea-readonly" : ""}`}
                    value={showResponse}
                    readOnly={!isEditing}
                    onChange={(e) => setDraftResponse(e.target.value)}
                    spellCheck={false}
                    rows={3}
                    placeholder="Response JSON"
                  />
                </div>
                <div className="trigger-row-actions mock-saved-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="mock-save-btn"
                        disabled={!draftMatch.trim()}
                        onClick={saveEditMock}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="mock-cancel-btn"
                        onClick={cancelEditMock}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mock-edit-btn"
                      onClick={() => startEditMock(label, m.response)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className={`mock-send-through-btn ${sendThrough ? "mock-send-through-on" : ""}`}
                    onClick={() => toggleMockSendToServer(selectedId, label)}
                    title={mockSendThroughTitle}
                    aria-label={mockSendThroughAria}
                    aria-pressed={sendThrough}
                  >
                    <span
                      className="mock-send-through-indicator"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className="mock-remove-btn"
                    onClick={() => {
                      if (isEditing) cancelEditMock();
                      removeMockResponse(selectedId, label);
                    }}
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mock-add-form">
          <input
            className="mock-match-input"
            placeholder="method or action"
            value={newMatch}
            onChange={(e) => setNewMatch(e.target.value)}
            spellCheck={false}
          />
          <textarea
            className="trigger-input mock-response-textarea"
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
