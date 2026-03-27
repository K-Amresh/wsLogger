# WS Logger — Chrome DevTools Extension

A Chrome/Edge DevTools extension that intercepts all WebSocket connections on a page and logs their messages in a dedicated panel. Built with React, TypeScript, Vite, and Zustand.

## Features

- **Live WebSocket interception** — Captures all `WebSocket` connections and their messages in real time via monkey-patching (no permissions required beyond content scripts).
- **Connection sidebar** — Lists every WebSocket connection with its status (connecting / open / closed / error) and message count.
- **Request / Response correlation** — Matches outgoing messages to incoming responses by `id`, shows wait times and pending indicators. Supports **multiple responses** per request with sub-tabs (Response 1, Response 2, …).
- **Cross-navigation via ID** — In the correlated view (Response/Request tab), the `id` field in the JSON tree is a hyperlink that selects the correlated message.
- **Stack traces** — Captures call stacks for every sent message and WebSocket connection. Stack frames are clickable and open the corresponding source file in the DevTools Sources panel. The injected script strips the `Error` header while preserving `at …` frames, and filters out internal `inject.js` frames for a clean trace.
- **JSON Tree viewer** — Toggle between a raw text view and an interactive, collapsible JSON tree (DevTools console style) for any message payload. Right-click context menu supports "Copy as string", "Copy as object", and "Copy".
- **Search & filter** — Full-text search across message payloads, with All / Requests / Responses filter tabs (filter state is local per connection).
- **Per-connection storage** — Messages are stored per connection (`wsId → messages[]`), making clears and lookups efficient.
- **HAR import / export** — Export captured WebSocket data as a HAR 1.2 file; import previously exported `.har` files to restore sessions.
- **Resizable detail panel** — Drag the handle to resize the message detail area.
- **Recording toggle** — Pause and resume capture; state is preserved across page navigations (defaults to off).
- **Tools panel** — Per selected connection: **Trigger** (send preset payloads through the live socket), **Interceptor** (transform incoming frames with a page-defined function), and **Mock responses** (synthetic replies; see below).

## Tools: Trigger and Interceptor

Open the **WS Logger** DevTools tab, select a WebSocket in the sidebar, then expand **Tools**. Rules apply to the **selected** connection only.

### Trigger

Use **Trigger** to call `WebSocket#send` on that connection from the panel—equivalent to your app sending the same string. The socket must be **open**; the send button is disabled otherwise.

- **Payload** — Plain text. Use JSON when your protocol expects it (e.g. `{ "method": "…", "id": 1 }` or `{ "action": "…" }`). You can add **multiple rows** as quick presets; each row has its own textarea and send button.
- **Flow** — The panel forwards the payload to the injected script, which calls `send` on the registered socket for that connection’s id. Outgoing messages are logged like any other send, including **stack traces** pointing at the extension/injected path (not your page).
- **Mocks** — If you have a **mock** whose match key equals the outgoing `method` or `action`, the same rules apply as for app-originated sends (green mock = no real network send + synthetic response; red = real send only).

### Interceptor

Use **Interceptor** to transform **incoming** message text before it reaches your page’s `message` listeners and before it appears in the logger.

- **Function** — Enter the name of a function on **`window`** (e.g. `myHook`). It receives the raw message **string** and must return the payload to use (a **string**, or an object that will be JSON-stringified). If the function is missing or throws, the original payload is kept.
- **Green / red** — **Green** runs the interceptor; **red** passes messages through unchanged.
- **Match** — Optional filter on the **received** JSON: the rule applies when your match string equals the message’s **`method`**, **`action`**, or **`type`** (after the same normalization as mocks—quotes trimmed, etc.). **Leave match empty** to run on every text frame. Responses that only set `type` (and not `method`/`action`) are supported when you match on that `type`.
- **Mocks** — If a **mock** synthesizes a reply, that synthetic payload is built first; then the **interceptor** runs on it when it matches, so the app and the log see the **transformed** result.

Implementation note: the hook runs in the page’s **main world** (`inject.js`), so your interceptor function must be assigned to `window` in page scripts, not only inside isolated extension worlds.

## Installation

### 1. Build the extension

```bash
# Clone / navigate to the project
cd wsLogger

# Install dependencies
npm install

# Build for production
npm run build
```

This compiles TypeScript and bundles the React app into the `dist/` folder alongside the files in `public/`.

### 2. Load in Chrome / Edge

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` folder inside this project.
5. Open DevTools (`F12` or `Cmd+Opt+I`) on any page — you will see a new **WS Logger** tab.

### Development mode

```bash
npm run dev
```

This runs `vite build --watch`, rebuilding on every file change. After a rebuild, go to `chrome://extensions`, click the refresh icon on the extension card, then re-open DevTools.

## Code Structure

```
wsLogger/
├── public/                          # Extension plumbing (plain JS, copied as-is to dist)
│   ├── manifest.json                # MV3 extension manifest
│   ├── devtools.html                # DevTools entry point
│   ├── devtools.js                  # Creates the "WS Logger" panel
│   ├── background.js                # Service worker — routes messages between
│   │                                  content scripts and the DevTools panel,
│   │                                  buffers messages when the panel isn't open
│   ├── inject.js                    # Runs in the page's MAIN world — monkey-patches
│   │                                  the WebSocket constructor and prototype to
│   │                                  capture connect/send/message/close/error events
│   └── content-script.js            # Runs in the ISOLATED world — relays
│                                      window.postMessage from inject.js to
│                                      chrome.runtime (background)
│
├── src/                             # React application (the DevTools panel UI)
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root component — layout, resizable detail panel
│   ├── App.css                      # All styles (dark theme, DevTools-inspired)
│   ├── types.ts                     # WsConnection, WsMessage, MessageFilter types
│   ├── utils.ts                     # formatDuration helper
│   ├── store.ts                     # Zustand store — connections, messages (per wsId),
│   │                                  correlations, selection, recording state
│   ├── hooks/
│   │   └── useChromeConnection.ts   # Hook that connects to the background service
│   │                                  worker via chrome.runtime.connect, dispatches
│   │                                  incoming events to the store, handles page
│   │                                  navigation resets
│   └── components/
│       ├── Toolbar.tsx              # Top bar — record toggle, active count, search,
│       │                              HAR export/import
│       ├── ConnectionList.tsx       # Left sidebar — connection list with status dots,
│       │                              per-connection clear
│       ├── MessageList.tsx          # Center — filtered message rows with timestamps,
│       │                              correlation badges, filter tabs, clear button
│       ├── MessageDetail.tsx        # Bottom — tabbed detail view (Data, Response/
│       │                              Request, Stack Trace), multi-response sub-tabs,
│       │                              pending timers, cross-navigation via ID links
│       ├── JsonTree.tsx             # JSON tree viewer with Raw/Tree toggle (DataView),
│                                      context menu (copy), clickable ID links
│       └── ConnectionTools.tsx      # Tools accordion — Trigger, Interceptor, mocks
│
├── index.html                       # Vite HTML entry
├── vite.config.ts                   # Vite config (React plugin, output to dist/)
├── tsconfig.json                    # TypeScript config
└── package.json
```

## Message Flow

```
Page (MAIN world)          Content Script (ISOLATED)       Background SW           DevTools Panel
─────────────────          ─────────────────────────       ──────────────           ──────────────
inject.js patches          content-script.js               background.js            React app
WebSocket constructor
        │                         │                              │                       │
        │  window.postMessage     │                              │                       │
        │ ──────────────────────> │                              │                       │
        │                         │  chrome.runtime.sendMessage  │                       │
        │                         │ ───────────────────────────> │                       │
        │                         │                              │  port.postMessage     │
        │                         │                              │ ────────────────────> │
        │                         │                              │                       │
        │                         │                              │  (buffered if panel   │
        │                         │                              │   not yet connected)  │
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript |
| State | Zustand 5 |
| Build | Vite 6 |
| Extension | Chrome Manifest V3 |

## Future Addon Possibilities

- **Message replay** — Resend a captured WebSocket message from the panel.
- **Binary frame support** — Decode and display `ArrayBuffer` / `Blob` payloads (e.g. Protobuf, MessagePack).
- **Connection filtering** — Filter the sidebar by URL pattern, status, or regex.
- **Diff view** — Compare two messages side-by-side to spot payload changes.
- **Auto-reconnect tracking** — Detect and group reconnection attempts to the same endpoint.
- **Metrics dashboard** — Visualize message throughput, latency distributions, and payload sizes over time.
- **Custom decoders** — Plugin system for user-defined message decoders (Protobuf schemas, custom framing).
- **Dark / Light theme toggle** — Currently dark-only; add a light theme option.
- **Firefox support** — Port to Firefox's DevTools extension API.
- **Bookmarkable messages** — Pin important messages so they survive clears.
- **Notifications** — Alert on specific message patterns (e.g. error codes, keywords).

## License

MIT
