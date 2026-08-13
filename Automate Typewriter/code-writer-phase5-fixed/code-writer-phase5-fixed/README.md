# Code Writer Phase 5.1 — Adapter Fix

The previous Phase 5 could detect the editor but could not access the page's
`window.codeWriterPractice` because Chrome content scripts run in an isolated
JavaScript world.

This version adds a `window.postMessage` bridge:

Popup → content script → page bridge → practice editor → content script → popup.

## Run

```powershell
python -m http.server 8000 --directory demo
```

Open:

http://localhost:8000/

Reload the extension at `chrome://extensions`, then refresh the IDE page.

The extension remains restricted to localhost/127.0.0.1.
