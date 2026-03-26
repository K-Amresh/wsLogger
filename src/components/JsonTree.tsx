import { useState, useMemo, useEffect, useCallback } from "react";

function previewValue(value: unknown, maxKeys = 3): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value.length > 40 ? value.slice(0, 40) + "..." : value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, maxKeys).map((v) => previewValue(v, 1));
    const suffix = value.length > maxKeys ? ", ..." : "";
    return `Array(${value.length}) [${items.join(", ")}${suffix}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    const items = keys.slice(0, maxKeys).map((k) => {
      const v = (value as Record<string, unknown>)[k];
      const short =
        v !== null && typeof v === "object"
          ? Array.isArray(v)
            ? `Array(${v.length})`
            : "{...}"
          : previewValue(v, 1);
      return `${k}: ${short}`;
    });
    const suffix = keys.length > maxKeys ? ", ..." : "";
    return `{${items.join(", ")}${suffix}}`;
  }
  return String(value);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function primitiveToString(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  return String(value);
}

interface ContextMenuState {
  x: number;
  y: number;
  value: unknown;
}

function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const { x, y, value } = state;
  const isExpandable =
    value !== null && typeof value === "object";

  useEffect(() => {
    const handle = () => onClose();
    document.addEventListener("click", handle);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") onClose();
    });
    return () => {
      document.removeEventListener("click", handle);
    };
  }, [onClose]);

  if (isExpandable) {
    return (
      <div className="json-context-menu" style={{ top: y, left: x }}>
        <button
          className="json-context-item"
          onClick={() => {
            copyToClipboard(JSON.stringify(value));
            onClose();
          }}
        >
          Copy as string
        </button>
        <button
          className="json-context-item"
          onClick={() => {
            copyToClipboard(JSON.stringify(value, null, 2));
            onClose();
          }}
        >
          Copy as object
        </button>
      </div>
    );
  }

  return (
    <div className="json-context-menu" style={{ top: y, left: x }}>
      <button
        className="json-context-item"
        onClick={() => {
          copyToClipboard(primitiveToString(value));
          onClose();
        }}
      >
        Copy
      </button>
    </div>
  );
}

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null) return <span className="json-null">null</span>;
  if (value === undefined)
    return <span className="json-null">undefined</span>;
  if (typeof value === "string")
    return <span className="json-string">"{value}"</span>;
  if (typeof value === "number")
    return <span className="json-number">{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className="json-boolean">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function JsonNode({
  label,
  value,
  depth,
  defaultExpanded,
  onContextMenu,
}: {
  label?: string;
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
  onContextMenu: (e: React.MouseEvent, value: unknown) => void;
}) {
  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, value);
  };

  if (!isExpandable) {
    return (
      <div
        className="json-node"
        style={{ paddingLeft: depth * 16 }}
        onContextMenu={handleContext}
      >
        {label != null && (
          <>
            <span className="json-key">{label}</span>
            <span className="json-colon">: </span>
          </>
        )}
        <PrimitiveValue value={value} />
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div>
      <div
        className="json-node json-expandable"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleContext}
      >
        <span className="json-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
        {label != null && (
          <>
            <span className="json-key">{label}</span>
            <span className="json-colon">: </span>
          </>
        )}
        {!expanded && (
          <span className="json-preview">{previewValue(value)}</span>
        )}
        {expanded && (
          <span className="json-bracket">{openBracket}</span>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              label={key}
              value={val}
              depth={depth + 1}
              defaultExpanded={false}
              onContextMenu={onContextMenu}
            />
          ))}
          <div
            className="json-node"
            style={{ paddingLeft: depth * 16 }}
          >
            <span className="json-bracket">{closeBracket}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function JsonTree({ data }: { data: string }) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return undefined;
    }
  }, [data]);

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, value: unknown) => {
      setCtxMenu({ x: e.clientX, y: e.clientY, value });
    },
    [],
  );

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  if (parsed === undefined) {
    return <pre className="detail-code">{data}</pre>;
  }

  return (
    <div className="json-tree">
      <JsonNode
        value={parsed}
        depth={0}
        defaultExpanded={true}
        onContextMenu={handleContextMenu}
      />
      {ctxMenu && <ContextMenu state={ctxMenu} onClose={closeMenu} />}
    </div>
  );
}

export function DataView({ data }: { data: string }) {
  const [view, setView] = useState<"tree" | "raw">("raw");

  return (
    <div className="data-view">
      <div className="data-view-bar">
        <button
          className={`data-view-btn ${view === "tree" ? "active" : ""}`}
          onClick={() => setView("tree")}
        >
          Tree
        </button>
        <button
          className={`data-view-btn ${view === "raw" ? "active" : ""}`}
          onClick={() => setView("raw")}
        >
          Raw
        </button>
      </div>
      {view === "raw" ? (
        <pre className="detail-code">{data}</pre>
      ) : (
        <JsonTree data={data} />
      )}
    </div>
  );
}
