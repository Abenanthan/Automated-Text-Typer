'use strict';

const DEFAULTS = { wpm: 380, jitter: 0.35, chunkIndent: true, startDelayMs: 3000 };

const $ = id => document.getElementById(id);
const el = {
  snippet: $('snippet'), wpm: $('wpm'), jitter: $('jitter'), delay: $('delay'),
  chunkIndent: $('chunkIndent'), start: $('start'), target: $('target'),
  wpmOut: $('wpmOut'), jitterOut: $('jitterOut'), delayOut: $('delayOut')
};

const activeTab = async () =>
  (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

function readOpts() {
  return {
    wpm: +el.wpm.value,
    jitter: +el.jitter.value / 100,
    startDelayMs: +el.delay.value * 1000,
    chunkIndent: el.chunkIndent.checked
  };
}

function paintOuts() {
  el.wpmOut.textContent = el.wpm.value;
  el.jitterOut.textContent = el.jitter.value;
  el.delayOut.textContent = el.delay.value;
}

async function persist() {
  paintOuts();
  await chrome.storage.local.set({ snippet: el.snippet.value, opts: readOpts() });
}

async function restore() {
  const { snippet = '', opts = {} } = await chrome.storage.local.get(['snippet', 'opts']);
  const o = { ...DEFAULTS, ...opts };
  el.snippet.value = snippet;
  el.wpm.value = o.wpm;
  el.jitter.value = Math.round(o.jitter * 100);
  el.delay.value = Math.round(o.startDelayMs / 1000);
  el.chunkIndent.checked = o.chunkIndent;
  paintOuts();
}

async function probe() {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'CCT_PROBE' });
    if (res?.adapter) {
      el.target.textContent = res.adapter;
      el.target.classList.add('found');
      return;
    }
  } catch (_) { /* no content script on this page */ }
  el.target.textContent = 'no editor found';
}

el.start.addEventListener('click', async () => {
  const text = el.snippet.value;
  if (!text) { el.snippet.focus(); return; }
  await persist();
  const tab = await activeTab();
  if (!tab?.id) return;
  chrome.runtime.sendMessage({ type: 'CCT_START', tabId: tab.id, text, opts: readOpts() });
  // Close so focus returns to the page before the countdown ends.
  window.close();
});

// Tab should indent the snippet, not move focus out of the textarea.
el.snippet.addEventListener('keydown', ev => {
  if (ev.key !== 'Tab') return;
  ev.preventDefault();
  const { selectionStart: s, selectionEnd: e, value } = el.snippet;
  el.snippet.value = value.slice(0, s) + '    ' + value.slice(e);
  el.snippet.selectionStart = el.snippet.selectionEnd = s + 4;
});

for (const node of [el.snippet, el.wpm, el.jitter, el.delay, el.chunkIndent]) {
  node.addEventListener('input', persist);
}

restore().then(probe);
