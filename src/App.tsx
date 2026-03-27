import { useCallback, useRef, useState } from "react";
import { useChromeConnection } from "./hooks/useChromeConnection";
import { useStore } from "./store";
import { Toolbar } from "./components/Toolbar";
import { ConnectionList } from "./components/ConnectionList";
import { ConnectionTools } from "./components/ConnectionTools";
import { MessageList } from "./components/MessageList";
import { MessageDetail } from "./components/MessageDetail";

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 240;

export default function App() {
  useChromeConnection();

  const hasSelection = useStore((s) => s.selectedMessage != null);
  const [detailHeight, setDetailHeight] = useState(250);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const contentRef = useRef<HTMLDivElement>(null);

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      setSidebarWidth(
        Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + delta)),
      );
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      const newH = rect.bottom - ev.clientY;
      setDetailHeight(Math.max(80, Math.min(newH, rect.height * 0.75)));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main-layout">
        <div
          className="sidebar"
          style={{ width: sidebarWidth, flexShrink: 0 }}
        >
          <ConnectionList />
          <ConnectionTools />
        </div>
        <div
          className="sidebar-resize-handle"
          onMouseDown={onSidebarResizeStart}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
        />
        <div className="content-area" ref={contentRef}>
          <MessageList />
          {hasSelection && (
            <div className="resize-handle" onMouseDown={onResizeStart} />
          )}
          <div
            className="detail-wrapper"
            style={
              hasSelection ? { height: detailHeight, flexShrink: 0 } : undefined
            }
          >
            <MessageDetail />
          </div>
        </div>
      </div>
    </div>
  );
}
