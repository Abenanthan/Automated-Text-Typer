/*
 * background.js — orchestration.
 *
 * A page can hold several frames (LeetCode and HackerRank both mount the editor
 * in one), so a run is broadcast to all of them and the frame holding focus
 * claims it. The HUD always lives in frame 0 regardless of which frame types.
 */

const DEFAULTS = { wpm: 380, jitter: 0.35, chunkIndent: true, startDelayMs: 3000 };

/** tabId -> { claimed: boolean, timer: number } */
const runs = new Map();

const toFrame0 = (tabId, msg) =>
  chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => {});
const toAllFrames = (tabId, msg) =>
  chrome.tabs.sendMessage(tabId, msg).catch(() => {});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startRun(tabId, text, opts) {
  if (!text) return;
  const o = { ...DEFAULTS, ...opts };

  if (runs.has(tabId)) clearTimeout(runs.get(tabId).timer);
  runs.set(tabId, { claimed: false, timer: 0 });

  // Countdown gives the user time to click into the editor after the popup closes.
  for (let left = Math.ceil(o.startDelayMs / 1000); left > 0; left--) {
    toFrame0(tabId, { type: 'CCT_HUD', label: `Starting in ${left}…` });
    await sleep(1000);
  }

  toFrame0(tabId, { type: 'CCT_HUD', label: 'Typing', typed: 0, total: text.length });
  toAllFrames(tabId, { type: 'CCT_TRY', text, opts: o });

  // If no frame reported focus, fall back to the top frame.
  const run = runs.get(tabId);
  if (!run) return;
  run.timer = setTimeout(() => {
    if (!runs.get(tabId)?.claimed) {
      toFrame0(tabId, { type: 'CCT_TRY_FORCE', text, opts: o });
    }
  }, 400);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = msg.tabId ?? sender.tab?.id;
  if (tabId == null) return;

  switch (msg.type) {
    case 'CCT_START':
      startRun(tabId, msg.text, msg.opts);
      break;

    case 'CCT_STARTED': {
      const run = runs.get(tabId);
      if (run) run.claimed = true;
      break;
    }

    case 'CCT_STOP':
      toAllFrames(tabId, { type: 'CCT_STOP_FRAME' });
      break;

    case 'CCT_ENGINE_EVENT':
      relay(tabId, msg);
      break;
  }
});

function relay(tabId, msg) {
  const d = msg.data || {};
  switch (msg.event) {
    case 'start':
      toFrame0(tabId, { type: 'CCT_HUD', label: 'Typing', typed: 0, total: d.total });
      break;
    case 'progress':
      toFrame0(tabId, { type: 'CCT_HUD', label: 'Typing', typed: d.typed, total: d.total });
      break;
    case 'paused':
      toFrame0(tabId, { type: 'CCT_HUD', label: d.paused ? 'Paused' : 'Typing' });
      break;
    case 'error':
      toFrame0(tabId, { type: 'CCT_HUD', label: d.message || 'Error' });
      setTimeout(() => toFrame0(tabId, { type: 'CCT_HUD', hide: true }), 4000);
      runs.delete(tabId);
      break;
    case 'done':
      toFrame0(tabId, {
        type: 'CCT_HUD',
        label: d.cancelled ? 'Stopped' : 'Done',
        typed: d.typed, total: d.total
      });
      setTimeout(() => toFrame0(tabId, { type: 'CCT_HUD', hide: true }), 1800);
      runs.delete(tabId);
      break;
  }
}

chrome.commands.onCommand.addListener(async command => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-pause') {
    toAllFrames(tab.id, { type: 'CCT_PAUSE' });
    return;
  }
  if (command === 'start-typing') {
    const { snippet = '', opts = {} } = await chrome.storage.local.get(['snippet', 'opts']);
    startRun(tab.id, snippet, opts);
  }
});

chrome.tabs.onRemoved.addListener(tabId => runs.delete(tabId));
