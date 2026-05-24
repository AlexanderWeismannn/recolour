chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "pick-and-paint",
      title: "Recolour",
      contexts: ["all"]
    });
  });
});

function buildScriptTarget(tabId, frameId) {
  const target = { tabId };
  if (typeof frameId === "number") {
    target.frameIds = [frameId];
  } else {
    target.allFrames = true;
  }
  return target;
}

function showActivationToast() {
  const el = document.createElement("div");
  el.textContent = "Recolour activated — right-click again";
  el.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "bottom:20px",
    "right:20px",
    "background:rgba(0,0,0,0.85)",
    "color:#fff",
    "padding:8px 14px",
    "border-radius:6px",
    "font:13px/1.4 system-ui,sans-serif",
    "pointer-events:none",
    "box-shadow:0 4px 12px rgba(0,0,0,0.3)",
    "transition:opacity 0.3s"
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
  }, 2200);
  setTimeout(() => el.remove(), 2700);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== "pick-and-paint") return;

  const sendOptions =
    typeof info.frameId === "number" ? { frameId: info.frameId } : {};

  try {
    await chrome.tabs.sendMessage(
      tab.id,
      { type: "pick-and-paint" },
      sendOptions
    );
    return;
  } catch (_) {
    // Content script not present (page was open before the extension loaded,
    // or this page disallows the content script). Try to inject it now.
  }

  try {
    const scriptTarget = buildScriptTarget(tab.id, info.frameId);
    await chrome.scripting.executeScript({
      target: scriptTarget,
      files: ["content.js"]
    });
    await chrome.scripting.executeScript({
      target: scriptTarget,
      func: showActivationToast
    });
  } catch (e) {
    console.warn("Recolour: could not inject content script", e);
  }
});
