import { useCallback, useRef, useState } from "react";
import { useChromeConnection } from "./hooks/useChromeConnection";
import { useStore } from "./store";
import { Toolbar } from "./components/Toolbar";
import { ConnectionList } from "./components/ConnectionList";
import { ConnectionTools } from "./components/ConnectionTools";
import { MessageList } from "./components/MessageList";
import { MessageDetail } from "./components/MessageDetail";

export default function App() {
  useChromeConnection();

  const hasSelection = useStore((s) => s.selectedMessage != null);
  const [detailHeight, setDetailHeight] = useState(250);
  const contentRef = useRef<HTMLDivElement>(null);

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
        <div className="sidebar">
          <ConnectionList />
          <ConnectionTools />
        </div>
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
