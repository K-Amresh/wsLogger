/** Max frames we allow for `Error.stackTraceLimit` (panel + injected page). */
export const STACK_TRACE_LIMIT_MAX = 200;

/** Read engine default in DevTools context; fallback 10 if invalid. */
export function getInitialStackTraceLimit(): number {
  const Err = Error as unknown as { stackTraceLimit?: number };
  const raw =
    typeof Err.stackTraceLimit === "number" ? Err.stackTraceLimit : 10;
  return clampStackTraceLimit(raw);
}

export function clampStackTraceLimit(n: number): number {
  if (!Number.isFinite(n)) return 10;
  const f = Math.floor(n);
  if (f < 1) return 1;
  if (f > STACK_TRACE_LIMIT_MAX) return STACK_TRACE_LIMIT_MAX;
  return f;
}

/** Strip whitespace and optional surrounding quotes from mock action keys. */
export function normalizeMockAction(s: string): string {
  let t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      t = t.slice(1, -1).trim();
    }
  }
  return t;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}
