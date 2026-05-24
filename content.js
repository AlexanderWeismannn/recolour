if (window.__pickAndPaintLoaded) {
  // Already initialized in this frame; skip re-binding listeners.
} else {
  window.__pickAndPaintLoaded = true;

let lastTarget = null;
let lastX = 0;
let lastY = 0;
let activeCleanup = null;

document.addEventListener(
  "contextmenu",
  (e) => {
    lastTarget = e.target;
    lastX = e.clientX;
    lastY = e.clientY;
  },
  true
);

const BTN_STYLE =
  "background:#f3f3f3;border:1px solid #ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font:inherit;color:#222;";

function parseRgb(rgb) {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
}

function hex2(v) {
  return Math.round(v).toString(16).padStart(2, "0");
}

function toHex(rgb) {
  const c = parseRgb(rgb);
  if (!c) return "#000000";
  const base = "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
  if (c.a < 1) return base + hex2(c.a * 255);
  return base;
}

function toHex6(rgb) {
  const c = parseRgb(rgb);
  if (!c) return "#000000";
  return "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0;";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    ta.remove();
  }
  toast(`Copied ${text}`);
}

function toast(message) {
  const el = document.createElement("div");
  el.textContent = message;
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
  }, 1500);
  setTimeout(() => el.remove(), 1900);
}

function paintEntireElement(el, color) {
  el.style.setProperty("background-image", "none", "important");
  el.style.setProperty("background-color", color, "important");
  const descendants = el.querySelectorAll("*");
  for (const d of descendants) {
    d.style.setProperty("background-image", "none", "important");
    d.style.setProperty("background-color", color, "important");
  }
}

function snapshotStyles(elements) {
  return elements.map((el) => ({ el, cssText: el.style.cssText }));
}

function restoreStyles(snapshot) {
  for (const { el, cssText } of snapshot) {
    el.style.cssText = cssText;
  }
}

function createHighlight(target) {
  const box = document.createElement("div");
  box.id = "__pp-highlight";
  box.style.cssText = [
    "position:fixed",
    "z-index:2147483646",
    "border:3px solid #ffd60a",
    "border-radius:2px",
    "box-sizing:border-box",
    "pointer-events:none",
    "box-shadow:0 0 0 1px rgba(0,0,0,0.25)"
  ].join(";");
  document.body.appendChild(box);

  const update = () => {
    const r = target.getBoundingClientRect();
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };
  update();

  window.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  const ro = new ResizeObserver(update);
  ro.observe(target);

  return {
    setVisible: (v) => {
      box.style.display = v ? "" : "none";
    },
    remove: () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      ro.disconnect();
      box.remove();
    }
  };
}

function makeDraggable(panel, handle) {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const newLeft = Math.max(0, Math.min(window.innerWidth - w, startLeft + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - h, startTop + dy));
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  };

  const onUp = () => {
    dragging = false;
    document.body.style.userSelect = "";
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = panel.getBoundingClientRect();
    startLeft = r.left;
    startTop = r.top;
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  handle.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  return () => {
    handle.removeEventListener("mousedown", onDown);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
}

function hasVisibleBorder(style) {
  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    if (
      parseFloat(style[`border${side}Width`]) > 0 &&
      style[`border${side}Style`] !== "none"
    ) {
      return true;
    }
  }
  return false;
}

function extractShadowColor(boxShadow) {
  if (!boxShadow || boxShadow === "none") return null;
  const m = boxShadow.match(/rgba?\([^)]+\)/);
  return m ? m[0] : null;
}

function recolorShadow(boxShadow, newColor) {
  if (!boxShadow || boxShadow === "none") return null;
  return boxShadow.replace(/rgba?\([^)]+\)/g, newColor);
}

function hasDirectText(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      return true;
    }
  }
  return false;
}

function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `<${tag}#${el.id}>`;
  if (typeof el.className === "string" && el.className.trim()) {
    const first = el.className.trim().split(/\s+/)[0];
    const trunc = first.length > 20 ? first.slice(0, 17) + "…" : first;
    return `<${tag}.${trunc}>`;
  }
  return `<${tag}>`;
}

function collectNearbyColors(target) {
  const root = document.body || target;
  const elements = [root, ...root.querySelectorAll("*")].slice(0, 2000);
  const counts = new Map();
  const props = ["backgroundColor", "color", "borderTopColor"];
  for (const el of elements) {
    const s = getComputedStyle(el);
    for (const p of props) {
      const v = s[p];
      const c = parseRgb(v);
      if (!c || c.a < 0.1) continue;
      const hex = toHex6(v);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([hex]) => hex);
}

function makeSuggestedSection(target, modes, onApply) {
  const section = document.createElement("div");
  section.style.cssText = "display:flex;flex-direction:column;gap:6px;";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;";

  const label = document.createElement("div");
  label.textContent = "Suggested";
  label.style.cssText =
    "font-weight:600;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;";

  let mode = modes[0];

  header.appendChild(label);

  if (modes.length > 1) {
    const tabs = document.createElement("div");
    tabs.style.cssText =
      "display:flex;border:1px solid #ccc;border-radius:4px;overflow:hidden;font-size:11px;";

    const TAB_BASE =
      "padding:2px 8px;cursor:pointer;border:none;font:inherit;font-size:11px;";
    const TAB_INACTIVE = TAB_BASE + "background:#fff;color:#555;";
    const TAB_ACTIVE = TAB_BASE + "background:#444;color:#fff;";

    const TAB_LABELS = {
      element: "Element",
      border: "Border",
      shadow: "Shadow",
      text: "Text"
    };

    const tabBtns = {};
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.textContent = TAB_LABELS[m] || m;
      btn.addEventListener("click", () => {
        mode = m;
        for (const key of Object.keys(tabBtns)) {
          tabBtns[key].style.cssText = key === mode ? TAB_ACTIVE : TAB_INACTIVE;
        }
      });
      tabBtns[m] = btn;
      tabs.appendChild(btn);
    }
    for (const key of Object.keys(tabBtns)) {
      tabBtns[key].style.cssText = key === mode ? TAB_ACTIVE : TAB_INACTIVE;
    }

    header.appendChild(tabs);
  }

  const swatches = document.createElement("div");
  swatches.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";

  const colors = collectNearbyColors(target);
  if (colors.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "—";
    empty.style.cssText = "color:#999;";
    swatches.appendChild(empty);
  } else {
    for (const hex of colors) {
      const sw = document.createElement("button");
      sw.title = hex;
      sw.style.cssText = [
        "width:22px",
        "height:22px",
        `background:${hex}`,
        "border:1px solid #999",
        "border-radius:3px",
        "cursor:pointer",
        "padding:0"
      ].join(";");
      sw.addEventListener("click", () => onApply(mode, hex));
      swatches.appendChild(sw);
    }
  }

  section.appendChild(header);
  section.appendChild(swatches);
  return section;
}

function makeRow(labelText, initialHex, onChange) {
  const row = document.createElement("div");
  row.style.cssText = "display:contents;";

  const labelEl = document.createElement("span");
  labelEl.textContent = labelText;
  labelEl.style.cssText = "font-weight:600;white-space:nowrap;";

  const input = document.createElement("input");
  input.type = "color";
  input.value = initialHex;
  input.title = "Click to pick a color";
  input.style.cssText =
    "width:40px;height:32px;padding:0;border:1px solid #bbb;border-radius:4px;cursor:pointer;background:transparent;";

  const valueEl = document.createElement("span");
  valueEl.textContent = initialHex;
  valueEl.style.cssText =
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#555;text-align:right;";

  const applyChange = () => {
    valueEl.textContent = input.value;
    onChange(input.value);
  };
  input.addEventListener("input", applyChange);
  input.addEventListener("change", applyChange);

  const dropperBtn = document.createElement("button");
  dropperBtn.title = "Pick color from page";
  dropperBtn.style.cssText =
    BTN_STYLE + "padding:4px 6px;display:inline-flex;align-items:center;";
  dropperBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';
  dropperBtn.addEventListener("click", async () => {
    if (!window.EyeDropper) {
      toast("EyeDropper not supported in this browser");
      return;
    }
    try {
      const ed = new EyeDropper();
      const { sRGBHex } = await ed.open();
      input.value = sRGBHex;
      valueEl.textContent = sRGBHex;
      onChange(sRGBHex);
    } catch (e) {
      // user cancelled the eyedropper
    }
  });

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.style.cssText = BTN_STYLE;
  copyBtn.addEventListener("click", () => copyText(input.value));

  row.appendChild(labelEl);
  row.appendChild(input);
  row.appendChild(valueEl);
  row.appendChild(dropperBtn);
  row.appendChild(copyBtn);

  return { row, input, valueEl };
}

function openPanel(target) {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  document.getElementById("__pp-picker")?.remove();
  document.getElementById("__pp-highlight")?.remove();

  const style = getComputedStyle(target);
  const initialBg = toHex6(style.backgroundColor);
  const initialFg = toHex6(style.color);

  const affected = [target, ...target.querySelectorAll("*")];
  const snapshot = snapshotStyles(affected);

  const panel = document.createElement("div");
  panel.id = "__pp-picker";
  panel.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:-9999px",
    "z-index:2147483647",
    "background:#fff",
    "color:#222",
    "border:1px solid #ccc",
    "border-radius:8px",
    "padding:0 0 10px 0",
    "box-shadow:0 6px 20px rgba(0,0,0,0.25)",
    "font:13px/1.4 system-ui,sans-serif",
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "max-width:calc(100vw - 16px)"
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:6px 6px 6px 12px",
    "background:#f7f7f7",
    "border-bottom:1px solid #eee",
    "border-radius:8px 8px 0 0",
    "cursor:move",
    "user-select:none",
    "font-weight:600",
    "color:#444"
  ].join(";");
  const grip = document.createElement("span");
  grip.textContent = "⋮⋮";
  grip.style.cssText = "color:#999;font-size:14px;letter-spacing:-2px;";
  const titleEl = document.createElement("span");
  titleEl.textContent = "Recolour";
  titleEl.style.cssText = "margin-right:auto;";
  const closeXBtn = document.createElement("button");
  closeXBtn.textContent = "×";
  closeXBtn.title = "Close";
  closeXBtn.setAttribute("aria-label", "Close");
  closeXBtn.style.cssText = [
    "background:transparent",
    "border:none",
    "color:#555",
    "font-size:18px",
    "font-weight:400",
    "line-height:1",
    "cursor:pointer",
    "padding:0",
    "margin:0",
    "width:22px",
    "height:22px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "border-radius:4px",
    "flex-shrink:0"
  ].join(";");
  closeXBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  closeXBtn.addEventListener("mouseenter", () => {
    closeXBtn.style.background = "#e8e8e8";
  });
  closeXBtn.addEventListener("mouseleave", () => {
    closeXBtn.style.background = "transparent";
  });
  header.appendChild(grip);
  header.appendChild(titleEl);
  header.appendChild(closeXBtn);

  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:0 12px;";

  const showText = hasDirectText(target);
  const showBorder = hasVisibleBorder(style);
  const showShadow = style.boxShadow && style.boxShadow !== "none";

  const initialBorder = showBorder ? toHex6(style.borderTopColor) : "#000000";
  const initialShadowColor = showShadow
    ? extractShadowColor(style.boxShadow)
    : null;
  const initialShadow = initialShadowColor
    ? toHex6(initialShadowColor)
    : "#000000";

  const elementRow = makeRow(describeElement(target), initialBg, (color) => {
    paintEntireElement(target, color);
  });

  const borderRow = showBorder
    ? makeRow("Border", initialBorder, (color) => {
        target.style.setProperty("border-color", color, "important");
      })
    : null;

  const shadowRow = showShadow
    ? makeRow("Shadow", initialShadow, (color) => {
        const current = getComputedStyle(target).boxShadow;
        const next = recolorShadow(current, color);
        if (next) target.style.setProperty("box-shadow", next, "important");
      })
    : null;

  const textRow = showText
    ? makeRow("Text", initialFg, (color) => {
        target.style.setProperty("color", color, "important");
      })
    : null;

  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;align-items:center;gap:8px;justify-content:flex-end;border-top:1px solid #eee;padding:8px 12px 0 12px;margin-top:2px;";

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.style.cssText = BTN_STYLE;
  resetBtn.addEventListener("click", () => {
    restoreStyles(snapshot);
    elementRow.input.value = initialBg;
    elementRow.valueEl.textContent = initialBg;
    if (borderRow) {
      borderRow.input.value = initialBorder;
      borderRow.valueEl.textContent = initialBorder;
    }
    if (shadowRow) {
      shadowRow.input.value = initialShadow;
      shadowRow.valueEl.textContent = initialShadow;
    }
    if (textRow) {
      textRow.input.value = initialFg;
      textRow.valueEl.textContent = initialFg;
    }
  });

  const highlight = createHighlight(target);

  const outlineLabel = document.createElement("label");
  outlineLabel.style.cssText =
    "display:flex;align-items:center;gap:6px;cursor:pointer;margin-right:auto;color:#555;user-select:none;";
  const outlineToggle = document.createElement("input");
  outlineToggle.type = "checkbox";
  outlineToggle.checked = true;
  outlineToggle.style.cssText = "cursor:pointer;margin:0;";
  const outlineText = document.createElement("span");
  outlineText.textContent = "Outline";
  outlineLabel.appendChild(outlineToggle);
  outlineLabel.appendChild(outlineText);
  outlineToggle.addEventListener("change", () => {
    highlight.setVisible(outlineToggle.checked);
  });

  const cleanup = () => {
    highlight.remove();
    removeDrag();
    panel.remove();
    if (activeCleanup === cleanup) activeCleanup = null;
  };

  closeXBtn.addEventListener("click", cleanup);

  actions.appendChild(outlineLabel);
  actions.appendChild(resetBtn);

  const rowsGrid = document.createElement("div");
  rowsGrid.style.cssText = [
    "display:grid",
    "grid-template-columns:auto 40px auto auto auto",
    "column-gap:10px",
    "row-gap:8px",
    "align-items:center",
    "justify-content:start"
  ].join(";");
  rowsGrid.appendChild(elementRow.row);
  if (borderRow) rowsGrid.appendChild(borderRow.row);
  if (shadowRow) rowsGrid.appendChild(shadowRow.row);
  if (textRow) rowsGrid.appendChild(textRow.row);

  body.appendChild(rowsGrid);

  const modes = ["element"];
  if (borderRow) modes.push("border");
  if (shadowRow) modes.push("shadow");
  if (textRow) modes.push("text");

  body.appendChild(
    makeSuggestedSection(target, modes, (mode, hex) => {
      if (mode === "element") {
        paintEntireElement(target, hex);
        elementRow.input.value = hex;
        elementRow.valueEl.textContent = hex;
      } else if (mode === "border" && borderRow) {
        target.style.setProperty("border-color", hex, "important");
        borderRow.input.value = hex;
        borderRow.valueEl.textContent = hex;
      } else if (mode === "shadow" && shadowRow) {
        const current = getComputedStyle(target).boxShadow;
        const next = recolorShadow(current, hex);
        if (next) target.style.setProperty("box-shadow", next, "important");
        shadowRow.input.value = hex;
        shadowRow.valueEl.textContent = hex;
      } else if (mode === "text" && textRow) {
        target.style.setProperty("color", hex, "important");
        textRow.input.value = hex;
        textRow.valueEl.textContent = hex;
      }
    })
  );

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(actions);
  document.body.appendChild(panel);

  const removeDrag = makeDraggable(panel, header);
  activeCleanup = cleanup;

  const rect = panel.getBoundingClientRect();
  const margin = 8;
  const x = Math.max(
    margin,
    Math.min(lastX, window.innerWidth - rect.width - margin)
  );
  const y = Math.max(
    margin,
    Math.min(lastY, window.innerHeight - rect.height - margin)
  );
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "pick-and-paint") return;
  if (!lastTarget || !lastTarget.isConnected) {
    toast("Recolour: no element selected");
    return;
  }
  openPanel(lastTarget);
});

}
