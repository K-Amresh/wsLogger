window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    !event.data ||
    event.data.source !== "__WS_LOGGER__"
  )
    return;

  try {
    chrome.runtime.sendMessage(event.data);
  } catch {
    // Extension context invalidated (e.g. extension reloaded)
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.source !== "__WS_LOGGER_CMD__") return;
  window.postMessage(message, "*");
});
