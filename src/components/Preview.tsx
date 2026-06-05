"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { injectLineAttrs } from "@/lib/jsxTransform";
import { processForPreview } from "@/lib/codeProcessor";
import type { Overrides, Selection, StyleMap } from "@/lib/types";

export interface PreviewHandle {
  /** Apply a style patch to one element immediately (live edit from property panel). */
  applyStyle: (id: string, style: StyleMap) => void;
  /** Clear the current selection highlight inside the iframe. */
  clearSelection: () => void;
  /** Select an element by its drowa id (breadcrumb / ancestor jump). */
  selectById: (id: string) => void;
}

interface PreviewProps {
  code: string;
  overrides: Overrides;
  /** Whether click/drag editing is armed. When false the iframe behaves as a plain preview. */
  editMode: boolean;
  onSelect: (sel: Selection | null) => void;
  /** Drag drop: absolute translate to persist for the element. */
  onMove: (id: string, transform: string) => void;
  /** Render/runtime error captured inside the iframe. */
  onError?: (err: { message: string; stack?: string; line?: number }) => void;
}

/**
 * Renders the project's App component inside a sandboxed iframe and bridges a
 * minimal visual-editor script to the parent via postMessage.
 *
 * sandbox="allow-scripts allow-same-origin" lets the injected script run and
 * talk to the parent. Origin is opaque-ish via srcDoc; we filter messages by
 * source and use a namespaced "drowa:" message protocol.
 */
export const Preview = forwardRef<PreviewHandle, PreviewProps>(function Preview(
  { code, overrides, editMode, onSelect, onMove, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Latest values for use inside the (stable) message listener.
  const overridesRef = useRef(overrides);
  const editModeRef = useRef(editMode);
  overridesRef.current = overrides;
  editModeRef.current = editMode;

  const srcDoc = useMemo(() => buildSrcDoc(code), [code]);

  function post(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }

  useImperativeHandle(ref, () => ({
    applyStyle(id, style) {
      post({ type: "drowa:updateStyle", id, style });
    },
    clearSelection() {
      post({ type: "drowa:clearSelection" });
    },
    selectById(id) {
      post({ type: "drowa:selectId", id });
    },
  }));

  // Push edit-mode + overrides whenever they change (and the iframe is alive).
  useEffect(() => {
    post({ type: "drowa:setEditMode", editMode });
  }, [editMode]);

  useEffect(() => {
    post({ type: "drowa:overrides", overrides });
  }, [overrides]);

  // Listen for messages coming from the iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as
        | { type: "drowa:ready" }
        | { type: "drowa:selected"; payload: Selection }
        | { type: "drowa:deselected" }
        | { type: "drowa:moved"; id: string; transform: string }
        | { type: "drowa:error"; message: string; stack?: string; line?: number };
      if (!data || typeof data.type !== "string") return;

      switch (data.type) {
        case "drowa:ready":
          // Handshake — re-send current state so a freshly (re)loaded iframe syncs.
          post({ type: "drowa:setEditMode", editMode: editModeRef.current });
          post({ type: "drowa:overrides", overrides: overridesRef.current });
          break;
        case "drowa:selected":
          onSelect(data.payload);
          break;
        case "drowa:deselected":
          onSelect(null);
          break;
        case "drowa:moved":
          onMove(data.id, data.transform);
          break;
        case "drowa:error":
          onError?.({ message: data.message, stack: data.stack, line: data.line });
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect, onMove, onError]);

  return (
    <iframe
      ref={iframeRef}
      title="preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
});

function buildSrcDoc(code: string): string {
  // Strip imports/exports to the bare `function App` the iframe expects, then
  // 3-7 §1: tag every JSX element with its source line before babel compiles it.
  const cleaned = processForPreview(code);
  const normalized = injectLineAttrs(cleaned);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
      html,body,#root{height:100%;margin:0;}
      [data-drowa-selected]{outline:2px solid #f59e0b !important;outline-offset:1px;}
      .drowa-edit [data-drowa-id]{cursor:pointer;}
      .drowa-dragging{opacity:.5 !important;}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript">
      function __report(err) {
        parent.postMessage({
          type: "drowa:error",
          message: String(err && err.message ? err.message : err),
          stack: String(err && err.stack ? err.stack : ""),
        }, "*");
      }
      class __ErrorBoundary extends React.Component {
        constructor(p) { super(p); this.state = { err: null }; }
        static getDerivedStateFromError(err) { return { err }; }
        componentDidCatch(err) { __report(err); }
        render() {
          if (this.state.err) {
            // Friendly one-liner in the preview; full detail goes to the parent.
            return React.createElement("div", { style: { padding: "24px", font: "14px ui-sans-serif,system-ui", color: "#888880" } },
              React.createElement("p", { style: { color: "#f5f5f0", margin: 0 } }, "Something went wrong rendering this."),
              React.createElement("p", { style: { margin: "6px 0 0" } }, "Use \\"Fix automatically\\" to repair it."));
          }
          return this.props.children;
        }
      }
      // Hooks available globally — generated code uses bare useState etc.
      const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, Fragment } = React;
      try {
        ${normalized}
        const Root = typeof App !== "undefined" ? App : (typeof __Default !== "undefined" ? __Default : null);
        if (!Root) throw new Error("No component named 'App' found. Define: function App() { return (...) }");
        ReactDOM.createRoot(document.getElementById("root")).render(
          React.createElement(__ErrorBoundary, null, React.createElement(Root))
        );
      } catch (err) {
        __report(err);
        document.getElementById("root").innerHTML =
          '<div style="padding:24px;font:14px ui-sans-serif,system-ui;color:#888880">' +
          '<p style="color:#f5f5f0;margin:0">Something went wrong rendering this.</p>' +
          '<p style="margin:6px 0 0">Use &quot;Fix automatically&quot; to repair it.</p></div>';
      }
    </script>
    ${EDITOR_SCRIPT}
  </body>
</html>`;
}

/** Minimal in-iframe visual editor: ids, click-select, drag-move, style apply. */
const EDITOR_SCRIPT = `<script>
(function () {
  // Layer 1 — runtime + promise errors inside the preview.
  window.addEventListener("error", function (e) {
    parent.postMessage({ type: "drowa:error", message: e.message, stack: (e.error && e.error.stack) || "", line: e.lineno }, "*");
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason || {};
    parent.postMessage({ type: "drowa:error", message: String(r.message || r), stack: String(r.stack || "") }, "*");
  });

  var STYLE_PROPS = ["color","backgroundColor","fontSize","fontFamily",
    "width","height","borderRadius",
    "paddingTop","paddingRight","paddingBottom","paddingLeft",
    "marginTop","marginRight","marginBottom","marginLeft"];
  var editMode = false;
  var overrides = {};
  var selected = null;
  var drag = null;
  var dragMoved = false;

  function send(msg) { parent.postMessage(msg, "*"); }

  // Assign stable ids in document order; reapply overrides after each (re)render.
  function indexDom() {
    var els = document.querySelectorAll("#root *");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      el.setAttribute("data-drowa-id", "el-" + i);
    }
    applyAll();
  }

  function applyOne(id, style) {
    var el = document.querySelector('[data-drowa-id="' + id + '"]');
    if (!el) return;
    for (var k in style) { if (style.hasOwnProperty(k)) el.style[k] = style[k]; }
  }
  function applyAll() {
    for (var id in overrides) { if (overrides.hasOwnProperty(id)) applyOne(id, overrides[id]); }
  }

  function readStyles(el) {
    var cs = getComputedStyle(el), out = {};
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      var p = STYLE_PROPS[i];
      out[p] = (el.style[p] || cs[p] || "").toString();
    }
    return out;
  }

  function lineOf(el) {
    var l = el.getAttribute("data-drowa-line");
    return l ? parseInt(l, 10) : 0;
  }

  // Ancestor chain root→element, for the breadcrumb (only nodes we can map).
  function pathOf(el) {
    var chain = [];
    var n = el;
    while (n && n.id !== "root") {
      if (n.getAttribute && n.getAttribute("data-drowa-id")) {
        chain.unshift({
          id: n.getAttribute("data-drowa-id"),
          line: lineOf(n),
          tag: n.tagName.toLowerCase()
        });
      }
      n = n.parentElement;
    }
    return chain;
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  function select(el) {
    if (selected) selected.removeAttribute("data-drowa-selected");
    selected = el;
    el.setAttribute("data-drowa-selected", "1");
    send({ type: "drowa:selected", payload: {
      id: el.getAttribute("data-drowa-id"),
      tag: el.tagName.toLowerCase(),
      line: lineOf(el),
      text: (el.textContent || "").trim().slice(0, 80),
      styles: readStyles(el),
      rect: rectOf(el),
      path: pathOf(el)
    }});
  }

  function deselect() {
    if (selected) selected.removeAttribute("data-drowa-selected");
    selected = null;
    send({ type: "drowa:deselected" });
  }

  document.addEventListener("click", function (e) {
    if (!editMode) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target.closest("[data-drowa-id]");
    if (!el) { deselect(); return; }          // 3-7 §5 — background click clears
    if (el === selected) {
      if (dragMoved) { dragMoved = false; return; }   // that click ended a drag
      // 3-7 §6 — re-click bubbles up to the parent element.
      var parent = el.parentElement && el.parentElement.closest("[data-drowa-id]");
      if (parent) { select(parent); return; }
      return;
    }
    select(el);
  }, true);

  // Drag the selected element; commit translate on drop.
  document.addEventListener("mousedown", function (e) {
    if (!editMode) return;
    var el = e.target.closest("[data-drowa-id]");
    if (!el || el !== selected) return;
    e.preventDefault();
    dragMoved = false;
    var base = (overrides[el.getAttribute("data-drowa-id")] || {}).transform || "";
    var m = /translate\\(([-0-9.]+)px,\\s*([-0-9.]+)px\\)/.exec(base);
    drag = { el: el, startX: e.clientX, startY: e.clientY,
             baseX: m ? parseFloat(m[1]) : 0, baseY: m ? parseFloat(m[2]) : 0 };
    el.classList.add("drowa-dragging");
  }, true);

  document.addEventListener("mousemove", function (e) {
    if (!drag) return;
    dragMoved = true;
    var x = drag.baseX + (e.clientX - drag.startX);
    var y = drag.baseY + (e.clientY - drag.startY);
    drag.el.style.transform = "translate(" + x + "px, " + y + "px)";
    drag.lastX = x; drag.lastY = y;
  }, true);

  document.addEventListener("mouseup", function () {
    if (!drag) return;
    drag.el.classList.remove("drowa-dragging");
    if (dragMoved) {
      var t = "translate(" + (drag.lastX || drag.baseX) + "px, " + (drag.lastY || drag.baseY) + "px)";
      send({ type: "drowa:moved", id: drag.el.getAttribute("data-drowa-id"), transform: t });
      send({ type: "drowa:selected", payload: {
        id: drag.el.getAttribute("data-drowa-id"),
        tag: drag.el.tagName.toLowerCase(),
        line: lineOf(drag.el),
        text: (drag.el.textContent || "").trim().slice(0, 80),
        styles: readStyles(drag.el),
        rect: rectOf(drag.el),
        path: pathOf(drag.el)
      }});
    }
    drag = null;
  }, true);

  // Keep the floating toolbar glued to the element as the preview scrolls.
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!selected || ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (selected) send({ type: "drowa:selected", payload: {
        id: selected.getAttribute("data-drowa-id"),
        tag: selected.tagName.toLowerCase(),
        line: lineOf(selected),
        text: (selected.textContent || "").trim().slice(0, 80),
        styles: readStyles(selected),
        rect: rectOf(selected),
        path: pathOf(selected)
      }});
    });
  }, true);

  window.addEventListener("message", function (e) {
    var d = e.data; if (!d || !d.type) return;
    if (d.type === "drowa:setEditMode") {
      editMode = !!d.editMode;
      document.body.classList.toggle("drowa-edit", editMode);
      if (!editMode && selected) { selected.removeAttribute("data-drowa-selected"); selected = null; }
    } else if (d.type === "drowa:overrides") {
      overrides = d.overrides || {};
      applyAll();
    } else if (d.type === "drowa:updateStyle") {
      overrides[d.id] = Object.assign({}, overrides[d.id], d.style);
      applyOne(d.id, d.style);
    } else if (d.type === "drowa:clearSelection") {
      if (selected) selected.removeAttribute("data-drowa-selected");
      selected = null;
    } else if (d.type === "drowa:selectId") {
      var el = document.querySelector('[data-drowa-id="' + d.id + '"]');
      if (el) select(el);
    }
  });

  // Wait for React to mount, then index + announce readiness.
  var tries = 0;
  (function wait() {
    if (document.querySelector("#root *") || tries > 40) { indexDom(); send({ type: "drowa:ready" }); }
    else { tries++; setTimeout(wait, 50); }
  })();
})();
</script>`;
