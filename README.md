# WS Logger — Chrome DevTools Extension

A Chrome/Edge DevTools extension that intercepts all WebSocket connections on a page and logs their messages in a dedicated panel. Built with React, TypeScript, Vite, and Zustand.

## Features

- **Live WebSocket interception** — Captures all `WebSocket` connections and their messages in real time via monkey-patching (no permissions required beyond content scripts).
- **Connection sidebar** — Lists every WebSocket connection with its status (connecting / open / closed / error) and message count.
- **Request / Response correlation** — Matches outgoing messages to incoming responses by `id`, shows wait times and pending indicators.
- **Stack traces** — Captures call stacks for every sent message; stack frames are clickable and open the source file in the DevTools Sources panel.
- **JSON Tree viewer** — Toggle between a raw text view and an interactive, collapsible JSON tree (DevTools console style) for any message payload.
- **Search & filter** — Full-text search across message payloads, with All / Requests / Responses filter tabs.
- **Per-connection storage** — Messages are stored per connection (`wsId → messages[]`), making clears and lookups efficient.
- **Resizable detail panel** — Drag the handle to resize the message detail area.
- **Recording toggle** — Pause and resume capture; state is preserved across page navigations.

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
│       ├── Toolbar.tsx              # Top bar — record toggle, active count, search
│       ├── ConnectionList.tsx       # Left sidebar — connection list with status dots
│       ├── MessageList.tsx          # Center — filtered message rows with timestamps,
│       │                              correlation badges, filter tabs
│       ├── MessageDetail.tsx        # Bottom — tabbed detail view (Data, Response,
│       │                              Stack Trace), pending timers, metadata
│       └── JsonTree.tsx             # JSON tree viewer with Raw/Tree toggle (DataView)
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
