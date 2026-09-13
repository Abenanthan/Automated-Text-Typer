/*
 * content.js — isolated-world bridge between the extension and engine.js.
 *
 * Runs in every frame. The background worker decides which frame actually types
 * (the one holding focus), and mirrors progress back into the top frame's HUD so
 * the readout stays visible even when the editor lives inside an iframe.
 */
(() => {
  'use strict';

  const FROM_CS = 'cct-cs';
  const FROM_ENGINE = 'cct-engine';
  const IS_TOP = window.top === window;

  const toEngine = msg => window.postMessage({ source: FROM_CS, ...msg }, '*');

  // ---------------------------------------------------------------------- HUD

  let hud = null;

  function ensureHud() {
    if (hud && hud.isConnected) return hud;
    hud = document.createElement('div');
    hud.id = 'cct-hud';
    hud.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        .box {
          position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
          font: 500 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
          background: #16181d; color: #e6e8ec; border: 1px solid #303540;
          border-radius: 10px; padding: 10px 12px; min-width: 190px;
          box-shadow: 0 8px 28px rgba(0,0,0,.42);
        }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .label { letter-spacing: .02em; }
        .count { color: #8b93a1; font-size: 11px; margin-top: 6px; }
        .bar { height: 3px; background: #2a2f39; border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .fill { height: 100%; width: 0%; background: #5b9dff; transition: width .12s linear; }
        button {
          font: inherit; font-size: 11px; cursor: pointer; color: #e6e8ec;
          background: #2a2f39; border: 1px solid #3a4150; border-radius: 6px; padding: 3px 9px;
        }
        button:hover { background: #343b47; }
        .hint { color: #6c7484; font-size: 10px; margin-top: 6px; }
      </style>
      <div class="box">
        <div class="row"><span class="label">Code Typer</span><button id="stop">Stop</button></div>
        <div class="count"></div>
        <div class="bar"><div class="fill"></div></div>
        <div class="hint">Esc to stop &middot; Alt+Shift+P to pause</div>
      </div>`;
    (document.body || document.documentElement).appendChild(hud);
    hud.shadowRoot.getElementById('stop').addEventListener('click', stopAll);
    return hud;
  }

  function paintHud({ label, typed, total, hide }) {
    if (hide) { hud?.remove(); hud = null; return; }
    const sr = ensureHud().shadowRoot;
    sr.querySelector('.label').textContent = label ?? 'Code Typer';
    if (total != null) {
      sr.querySelector('.count').textContent = `${typed} / ${total} chars`;
      sr.querySelector('.fill').style.width = `${total ? (typed / total) * 100 : 0}%`;
    } else {
      sr.querySelector('.count').textContent = '';
      sr.querySelector('.fill').style.width = '0%';
    }
  }

  const stopAll = () => chrome.runtime.sendMessage({ type: 'CCT_STOP' });

  // ------------------------------------------------------------ engine relay

  let pendingProbe = null;

  // Timers in this frame are throttled while the tab is hidden, so the engine's
  // between-keystroke waits are timed by the service worker over a port.
  let clockPort = null;

  function clock(id, ms) {
    try {
      if (!clockPort) {
        clockPort = chrome.runtime.connect({ name: 'cct-clock' });
        clockPort.onMessage.addListener(m => toEngine({ type: 'clock-tick', id: m.id }));
        clockPort.onDisconnect.addListener(() => { clockPort = null; });
      }
      clockPort.postMessage({ id, ms });
    } catch (_) {
      // Extension context gone — the engine's own fallback timer takes over.
      clockPort = null;
    }
  }

  window.addEventListener('message', ev => {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m.source !== FROM_ENGINE) return;
    if (m.type === 'ready') return;
    if (m.type === 'clock') { clock(m.id, m.ms); return; }
    if (m.type === 'probe-result') {
      pendingProbe?.(m);
      pendingProbe = null;
      return;
    }
    chrome.runtime.sendMessage({ type: 'CCT_ENGINE_EVENT', event: m.type, data: m });
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') stopAll();
  }, true);

  // Tell the worker which frame the user last clicked into, so a run started
  // after they've switched tabs still lands in the right (possibly nested) frame.
  const reportFocus = () =>
    chrome.runtime.sendMessage({ type: 'CCT_FOCUS' }).catch(() => {});
  window.addEventListener('focus', reportFocus);
  if (document.hasFocus()) reportFocus();

  // ---------------------------------------------------------- from background

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'CCT_HUD':
        if (IS_TOP) paintHud(msg);
        break;

      case 'CCT_TRY':
        // Broadcast reaches every frame; only the one the user is actually
        // typing in should run, and it reports back so the worker knows the
        // fallback is unnecessary.
        if (!document.hasFocus()) break;
        toEngine({ type: 'start', text: msg.text, opts: msg.opts });
        chrome.runtime.sendMessage({ type: 'CCT_STARTED' });
        break;

      case 'CCT_TRY_FORCE':
        // No frame claimed focus — fall back to the top frame and let engine.js
        // pick the first visible editor it can find.
        toEngine({ type: 'start', text: msg.text, opts: msg.opts });
        break;

      case 'CCT_PROBE':
        // The popup asks every frame; only frames that found an editor answer,
        // so an empty result means the page has nothing typeable.
        pendingProbe = res => { if (res.adapter) sendResponse({ adapter: res.adapter }); };
        toEngine({ type: 'probe' });
        setTimeout(() => { pendingProbe = null; }, 250);
        return true;

      case 'CCT_PAUSE':
        toEngine({ type: 'pause' });
        break;

      case 'CCT_STOP_FRAME':
        toEngine({ type: 'stop' });
        break;
    }
    // Only CCT_PROBE answers asynchronously; everything else is fire-and-forget,
    // so don't hold the message channel open.
    return false;
  });
})();
