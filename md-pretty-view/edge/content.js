// MD Pretty View — browser content script (stub).
// Injects the shared markdown theme so rendered markdown looks identical to the
// VS Code extension. `theme.css` is generated from ../shared/crossnote/style.less
// (see shared/README.md); wire up a LESS build before shipping.
(() => {
  const href = chrome.runtime.getURL("theme.css");
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
})();
