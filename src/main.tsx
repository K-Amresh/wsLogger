import { createRoot } from "react-dom/client";
import { persistMockResponsesFromState } from "./persistence";
import { useStore } from "./store";
import App from "./App";
import "./App.css";

// Only persist when mockResponses changes. `connections` updates on every message
// (messageCount), so watching it would write localStorage every frame and freeze the UI.
let prevMocks = useStore.getState().mockResponses;
useStore.subscribe((state) => {
  if (state.mockResponses === prevMocks) return;
  prevMocks = state.mockResponses;
  persistMockResponsesFromState(state);
});

createRoot(document.getElementById("root")!).render(<App />);
