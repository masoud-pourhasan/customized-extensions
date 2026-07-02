// ============================================================
//  Mermaid pan / zoom for MPE (preview + HTML export)
//  Loaded as a whitelisted document script via `@import`
//  (injected into every markdown file by ../.crossnote/parser.js).
//  Requires `markdown-preview-enhanced.enableScriptExecution: true`.
//
//  NOTE: this MUST be an @import-ed .js file. Scripts placed in
//  `.crossnote/head.html` are stripped by MPE (resolvePathsInHeader
//  calls `$("script").remove()`), so head.html cannot run JS.
//
//  Controls per diagram:
//    • Zoom  — pinch on a trackpad, or Ctrl/⌘ + mouse wheel, or the +/− buttons
//    • Pan   — click & drag
//    • Reset — double-click, or the ⟲ button
//    • Resize the viewport — drag the box's bottom edge
//
//  WHY DELEGATION: MPE 0.8.30's preview is a React app that manages the
//  preview body via innerHTML / dangerouslySetInnerHTML. When React
//  reconciles, it recreates DOM nodes from an HTML *string*: inline styles
//  and data-* attributes survive (so the buttons and the zoom transform
//  persist visually), but imperatively-attached event listeners are DROPPED.
//  That made the controls render yet do nothing on click. So all interaction
//  is delegated to listeners bound ONCE on `document` (a node React never
//  recreates), and all pan/zoom state lives in data-* attributes on the
//  wrapper (which serialize), never in per-node closures.
// ============================================================
(function () {
  var STATE_ATTACHED = "__mmdPzDelegated";

  function init() {
    try { console.log("[mmd-pz] init"); } catch (e) {}

    // Proof-of-life badge so it's obvious the script executed.
    if (!document.getElementById("mmd-pz-badge")) {
      var badge = document.createElement("div");
      badge.id = "mmd-pz-badge";
      badge.textContent = "Mermaid pan/zoom active";
      badge.style.cssText =
        "position:fixed;bottom:10px;right:10px;z-index:99999;background:#2563eb;color:#fff;" +
        "font:12px/1.4 'Segoe UI',sans-serif;padding:4px 10px;border-radius:6px;opacity:.95;" +
        "box-shadow:0 1px 4px rgba(0,0,0,.4);pointer-events:none;transition:opacity .5s ease";
      (document.body || document.documentElement).appendChild(badge);
      setTimeout(function () { badge.style.opacity = "0"; }, 3500);
      setTimeout(function () { if (badge.parentNode) badge.remove(); }, 4200);
    }

    attachDelegates();

    // Build the viewport chrome (wrapper + controls + hint) around each SVG.
    function enablePanZoom(svg) {
      if (!svg || svg.dataset.pzBound) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.height) return;            // not laid out yet; retried by poll/observer
      // If a previous render already wrapped this SVG's slot, don't double-wrap.
      if (svg.parentNode && svg.parentNode.classList &&
          svg.parentNode.classList.contains("mmd-pz")) {
        svg.dataset.pzBound = "1";
        applyState(svg.parentNode);
        return;
      }
      svg.dataset.pzBound = "1";

      var wrap = document.createElement("div");
      wrap.className = "mmd-pz";
      wrap.dataset.pzOrigMaxW = svg.style.maxWidth || "";  // restored when back at scale 1
      svg.parentNode.insertBefore(wrap, svg);
      wrap.appendChild(svg);

      var hint = document.createElement("div");
      hint.className = "mmd-pz-hint";
      hint.textContent = "pinch / Ctrl+scroll = zoom · drag = pan · dbl-click = reset";
      wrap.appendChild(hint);

      svg.style.transformOrigin = "0 0";
      svg.style.display = "block";
      // Default (scale 1): the SVG stays fully RESPONSIVE (no width/height pin),
      // so it renders at its natural size and the frame can fit it exactly.
      // When zoomed, applyState() resizes the SVG's intrinsic width/height
      // (vector re-rasterization) instead of CSS transform:scale (which would
      // stretch a cached raster → blurry text).

      var bar = document.createElement("div");
      bar.className = "mmd-pz-ctl";
      [["＋", "in"], ["－", "out"], ["⟲", "reset"]].forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b[0];
        btn.setAttribute("data-pz-act", b[1]);   // action lives in markup, not a closure
        bar.appendChild(btn);
      });
      wrap.appendChild(bar);

      applyState(wrap);         // default = responsive, natural size
      fitFrame(wrap);           // size the frame to the whole diagram
      // Re-fit after layout settles and whenever the SVG's natural size changes
      // (fonts, container width, late mermaid render) — only while untouched.
      requestAnimationFrame(function () { fitFrame(wrap); });
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { fitFrame(wrap); });
        ro.observe(svg);
      }
    }

    function scan() {
      document
        .querySelectorAll(".mermaid svg, svg[id^='mermaid'], svg[aria-roledescription]")
        .forEach(enablePanZoom);
    }

    scan();
    var mo = new MutationObserver(scan);
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    // mermaid renders async — poll a few seconds in case the observer misses it.
    var tries = 0;
    var iv = setInterval(function () {
      scan();
      document.querySelectorAll(".mmd-pz").forEach(fitFrame);
      if (++tries > 25) clearInterval(iv);
    }, 250);
  }

  // ---- pan/zoom state stored on the wrapper's data-* (survives serialization) ----
  function getState(wrap) {
    return {
      scale: parseFloat(wrap.dataset.pzScale) || 1,
      tx: parseFloat(wrap.dataset.pzTx) || 0,
      ty: parseFloat(wrap.dataset.pzTy) || 0
    };
  }
  // True only in the untouched default view (no zoom, no pan).
  function isDefault(st) { return st.scale === 1 && st.tx === 0 && st.ty === 0; }
  function applyState(wrap) {
    var st = getState(wrap);
    var svg = wrap.querySelector("svg");
    if (!svg) return;
    svg.style.transformOrigin = "0 0";
    if (isDefault(st)) {
      // Fully responsive → natural size, so the frame fits the whole diagram.
      svg.style.width = "";
      svg.style.height = "";
      svg.style.maxWidth = wrap.dataset.pzOrigMaxW || "";
      svg.style.transform = "translate(0px,0px)";
    } else {
      // Crisp zoom: resize the SVG's intrinsic size (vectors re-rasterize);
      // translate handles panning. Never CSS transform:scale (blurry).
      var bw = parseFloat(wrap.dataset.pzBaseW) || 0;
      var bh = parseFloat(wrap.dataset.pzBaseH) || 0;
      if (bw && bh) {
        svg.style.maxWidth = "none";
        svg.style.width = (bw * st.scale) + "px";
        svg.style.height = (bh * st.scale) + "px";
      }
      svg.style.transform = "translate(" + st.tx + "px," + st.ty + "px)";
    }
  }

  // Capture the SVG's natural (scale-1) size just before we leave the default
  // view, so zoom/pan scale from the correct, fully-settled dimensions.
  function ensureBase(wrap) {
    if (!isDefault(getState(wrap))) return;
    var svg = wrap.querySelector("svg");
    var r = svg && svg.getBoundingClientRect();
    if (r && r.height) {
      wrap.dataset.pzBaseW = r.width;
      wrap.dataset.pzBaseH = r.height;
    }
  }

  // Size the frame (viewport) to the whole diagram while it's untouched.
  function fitFrame(wrap) {
    if (!isDefault(getState(wrap))) return;   // don't fight a user zoom/pan
    var svg = wrap.querySelector("svg");
    var h = svg && svg.getBoundingClientRect().height;
    if (h) wrap.style.height = Math.ceil(h) + "px";
  }
  function setState(wrap, st) {
    wrap.dataset.pzScale = st.scale;
    wrap.dataset.pzTx = st.tx;
    wrap.dataset.pzTy = st.ty;
    applyState(wrap);
  }
  function reset(wrap) { setState(wrap, { scale: 1, tx: 0, ty: 0 }); }
  // Zoom toward a point (cx,cy relative to the wrap). Defaults to its center.
  function zoomAt(wrap, factor, cx, cy) {
    ensureBase(wrap);
    var st = getState(wrap);
    var r = wrap.getBoundingClientRect();
    if (cx == null) cx = r.width / 2;
    if (cy == null) cy = r.height / 2;
    var ns = Math.min(24, Math.max(0.3, st.scale * factor));
    st.tx = cx - (cx - st.tx) * (ns / st.scale);
    st.ty = cy - (cy - st.ty) * (ns / st.scale);
    st.scale = ns;
    setState(wrap, st);
  }

  function closestWrap(node) {
    return node && node.closest ? node.closest(".mmd-pz") : null;
  }

  // ---- one-time delegated listeners on `document` (immune to React re-renders) ----
  function attachDelegates() {
    if (document[STATE_ATTACHED]) return;
    document[STATE_ATTACHED] = true;

    // Control buttons. Capture phase + stopPropagation so React's root
    // delegate never sees the click and can't trigger a re-render.
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".mmd-pz-ctl button") : null;
      if (!btn) return;
      var wrap = closestWrap(btn);
      if (!wrap) return;
      e.preventDefault();
      e.stopPropagation();
      var act = btn.getAttribute("data-pz-act");
      if (act === "in") zoomAt(wrap, 1.25);
      else if (act === "out") zoomAt(wrap, 0.8);
      else reset(wrap);
    }, true);

    // Ctrl/⌘ + wheel to zoom toward the cursor; plain scroll passes through.
    document.addEventListener("wheel", function (e) {
      var wrap = closestWrap(e.target);
      if (!wrap) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var r = wrap.getBoundingClientRect();
      zoomAt(wrap, Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false, capture: true });

    // Drag to pan. A single active-pan record replaces per-node closures.
    var pan = null;
    document.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest(".mmd-pz-ctl")) return; // not on controls
      var wrap = closestWrap(e.target);
      if (!wrap) return;
      ensureBase(wrap);
      var st = getState(wrap);
      pan = { wrap: wrap, sx: e.clientX - st.tx, sy: e.clientY - st.ty };
      wrap.classList.add("-grabbing");
    }, true);
    document.addEventListener("pointermove", function (e) {
      if (!pan) return;
      var st = getState(pan.wrap);
      st.tx = e.clientX - pan.sx;
      st.ty = e.clientY - pan.sy;
      setState(pan.wrap, st);
    }, true);
    function endPan() {
      if (!pan) return;
      pan.wrap.classList.remove("-grabbing");
      pan = null;
    }
    document.addEventListener("pointerup", endPan, true);
    document.addEventListener("pointercancel", endPan, true);

    // Double-click to reset.
    document.addEventListener("dblclick", function (e) {
      var wrap = closestWrap(e.target);
      if (!wrap) return;
      e.preventDefault();
      reset(wrap);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
