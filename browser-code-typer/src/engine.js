/*
 * engine.js — runs in the page's MAIN world so it can reach editor instances
 * (window.monaco, cm.CodeMirror, ace) that an isolated content script cannot see.
 *
 * Every adapter inserts through the editor's *programmatic* edit API rather than
 * synthesising key events. That matters: keystroke-level insertion makes the host
 * editor re-indent, auto-close brackets and expand snippets, so a pasted block
 * arrives mangled. Programmatic edits land the text byte-for-byte.
 */
(() => {
  'use strict';

  const FROM_CS = 'cct-cs';
  const FROM_ENGINE = 'cct-engine';

  // ---------------------------------------------------------------- adapters

  function monaco_(el) {
    if (!window.monaco || !el.closest || !el.closest('.monaco-editor')) return null;
    let ed = null;
    try {
      const all = monaco.editor.getEditors ? monaco.editor.getEditors() : [];
      ed = all.find(e => {
        const n = e.getDomNode && e.getDomNode();
        return n && n.contains(el);
      }) || all[0] || null;
    } catch (_) { /* Monaco version without getEditors */ }
    if (!ed) return null;
    return {
      name: 'monaco',
      focus: () => ed.focus(),
      insert(text) {
        ed.executeEdits('code-typer', [
          { range: ed.getSelection(), text, forceMoveMarkers: true }
        ]);
        ed.revealPositionInCenterIfOutsideViewport(ed.getPosition());
      },
      readPrefix() {
        const p = ed.getPosition();
        return ed.getModel().getLineContent(p.lineNumber).slice(0, p.column - 1);
      },
      deleteBefore(n) {
        const p = ed.getPosition();
        const range = new monaco.Range(p.lineNumber, p.column - n, p.lineNumber, p.column);
        ed.executeEdits('code-typer', [{ range, text: '', forceMoveMarkers: true }]);
      }
    };
  }

  function cm6_(el) {
    const host = el.closest && el.closest('.cm-editor');
    const view = host && (host.cmView?.view || host._cmView?.view || host.CodeMirror?.view);
    if (!view || !view.state) return null;
    return {
      name: 'codemirror6',
      focus: () => view.focus(),
      insert(text) {
        const sel = view.state.selection.main;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: text },
          selection: { anchor: sel.from + text.length },
          scrollIntoView: true
        });
      },
      readPrefix() {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        return view.state.sliceDoc(line.from, pos);
      },
      deleteBefore(n) {
        const pos = view.state.selection.main.head;
        view.dispatch({ changes: { from: pos - n, to: pos, insert: '' }, selection: { anchor: pos - n } });
      }
    };
  }

  function cm5_(el) {
    const host = el.closest && el.closest('.CodeMirror');
    const cm = host && host.CodeMirror;
    if (!cm || !cm.replaceSelection) return null;
    return {
      name: 'codemirror5',
      focus: () => cm.focus(),
      insert(text) {
        cm.replaceSelection(text, 'end');
        cm.scrollIntoView(null);
      },
      readPrefix() {
        const cur = cm.getCursor();
        return cm.getLine(cur.line).slice(0, cur.ch);
      },
      deleteBefore(n) {
        const cur = cm.getCursor();
        cm.replaceRange('', { line: cur.line, ch: cur.ch - n }, cur);
      }
    };
  }

  function ace_(el) {
    const host = el.closest && el.closest('.ace_editor');
    const ed = host && host.env && host.env.editor;
    if (!ed || !ed.insert) return null;
    return {
      name: 'ace',
      focus: () => ed.focus(),
      insert: text => ed.insert(text),
      readPrefix() {
        const pos = ed.getCursorPosition();
        return ed.session.getLine(pos.row).slice(0, pos.column);
      },
      deleteBefore(n) {
        const pos = ed.getCursorPosition();
        ed.session.doc.removeInLine(pos.row, pos.column - n, pos.column);
      }
    };
  }

  const TEXT_INPUT = /^(text|search|url|email|tel|password|number)$/;

  function textarea_(el) {
    const ok = el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && TEXT_INPUT.test(el.type));
    if (!ok) return null;
    return {
      name: 'textarea',
      focus: () => el.focus(),
      insert(text) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        // Go through the native value setter so React's onChange still fires;
        // assigning el.value directly is swallowed by controlled components.
        const setter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(el), 'value'
        ).set;
        setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
        el.selectionStart = el.selectionEnd = start + text.length;
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'insertText', data: text
        }));
      },
      readPrefix() {
        const s = el.selectionStart ?? el.value.length;
        const nl = el.value.lastIndexOf('\n', s - 1);
        return el.value.slice(nl + 1, s);
      },
      deleteBefore(n) {
        const s = el.selectionStart;
        const setter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(el), 'value'
        ).set;
        setter.call(el, el.value.slice(0, s - n) + el.value.slice(s));
        el.selectionStart = el.selectionEnd = s - n;
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'deleteContentBackward'
        }));
      }
    };
  }

  function contenteditable_(el) {
    const host = el.closest && el.closest('[contenteditable=""], [contenteditable="true"]');
    if (!host) return null;
    return {
      name: 'contenteditable',
      focus: () => host.focus(),
      insert(text) {
        if (text === '\n') document.execCommand('insertLineBreak');
        else document.execCommand('insertText', false, text);
      },
      readPrefix() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return '';
        const caret = sel.getRangeAt(0).cloneRange();
        caret.collapse(true);
        const pre = document.createRange();
        pre.setStart(host, 0);
        pre.setEnd(caret.startContainer, caret.startOffset);
        const text = pre.toString();
        const nl = text.lastIndexOf('\n');
        return text.slice(nl + 1);
      },
      deleteBefore(n) {
        // execCommand('delete') is the backspace command — used instead of a
        // direct range delete so any input-event listener the host page has
        // (the source of the auto-indent we're correcting) still observes it.
        for (let i = 0; i < n; i++) document.execCommand('delete');
      }
    };
  }

  // Order matters. Monaco and CM5 put focus on a hidden <textarea>, CM6 on a
  // contenteditable — so the rich editors must be probed before the generic
  // fallbacks or we'd type into their internal scratch element.
  const ADAPTERS = [monaco_, cm6_, cm5_, ace_, textarea_, contenteditable_];

  function resolveTarget() {
    let el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      // Nothing focused in this frame — fall back to the first editor we can see.
      el = document.querySelector(
        '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor, textarea, [contenteditable="true"]'
      );
    }
    if (!el) return null;
    for (const probe of ADAPTERS) {
      try {
        const a = probe(el);
        if (a) return a;
      } catch (_) { /* keep probing */ }
    }
    return null;
  }

  // ------------------------------------------------------------------ timing

  // 1 "word" is conventionally 5 characters, so wpm*5/60 chars per second.
  const baseDelay = wpm => 12000 / Math.max(1, wpm);

  function delayFor(ch, wpm, jitter) {
    let ms = baseDelay(wpm);
    if (ch === '\n') ms *= 3.2;          // line breaks read as a beat, not a keypress
    else if (ch === ' ') ms *= 0.6;
    else if (';{}()'.includes(ch)) ms *= 1.4;
    const spread = 1 + (Math.random() * 2 - 1) * jitter;
    return Math.max(0, ms * spread);
  }

  // Chrome clamps timers in a hidden tab to once a second (once a minute after
  // five minutes), which stalls a run as soon as the user switches tabs. While
  // hidden, borrow the extension service worker's clock instead — its timers
  // aren't tied to this page's visibility.
  let clockSeq = 0;
  const clockWaits = new Map();

  const sleep = ms => new Promise(resolve => {
    if (!document.hidden || ms <= 0) { setTimeout(resolve, ms); return; }
    const id = ++clockSeq;
    const done = () => { clockWaits.delete(id); resolve(); };
    clockWaits.set(id, done);
    // Safety net in case the worker never answers (extension reloaded, port
    // dropped): the throttled local timer still ends the wait eventually.
    setTimeout(() => clockWaits.get(id)?.(), ms + 1500);
    window.postMessage({ source: FROM_ENGINE, type: 'clock', id, ms }, '*');
  });

  // ------------------------------------------------------------------- state

  let run = null; // { cancelled, paused, typed, total }

  const emit = (type, payload) =>
    window.postMessage({ source: FROM_ENGINE, type, ...payload }, '*');

  async function type(text, opts) {
    const { wpm = 380, jitter = 0.35, chunkIndent = true } = opts || {};

    const target = resolveTarget();
    if (!target) { emit('error', { message: 'No editable target found in this frame.' }); return; }
    target.focus();

    // Split into units: a run of leading indentation counts as one unit, since
    // that is how indentation appears when a human presses Tab or the editor
    // indents for them. Everything else is per character. Indent units are
    // tagged so the loop below can reconcile them against auto-indent.
    const units = [];
    for (const line of text.split('\n')) {
      if (units.length) units.push({ t: '\n' });
      const m = chunkIndent ? line.match(/^[ \t]+/) : null;
      let rest = line;
      if (m) { units.push({ t: m[0], indent: true }); rest = line.slice(m[0].length); }
      for (const ch of rest) units.push({ t: ch });
    }

    run = { cancelled: false, paused: false, typed: 0, total: text.length };
    emit('start', { total: run.total });

    let sinceReport = 0;
    for (const unit of units) {
      if (run.cancelled) break;
      while (run.paused && !run.cancelled) await sleep(80);
      if (run.cancelled) break;

      try {
        // Many editors auto-indent on newline (matching or extending the
        // previous line). If we blindly insert our own indent on top, it
        // compounds every line. Reconcile against what's actually there first.
        if (unit.indent && target.readPrefix) {
          const actual = target.readPrefix();
          if (/^[ \t]*$/.test(actual)) {
            if (unit.t.startsWith(actual)) {
              const rest = unit.t.slice(actual.length);
              if (rest) target.insert(rest);
            } else if (target.deleteBefore) {
              target.deleteBefore(actual.length);
              target.insert(unit.t);
            } else {
              target.insert(unit.t);
            }
          } else {
            target.insert(unit.t);
          }
        } else {
          target.insert(unit.t);
        }
      } catch (err) {
        emit('error', { message: 'Insert failed: ' + err.message });
        run = null;
        return;
      }

      run.typed += unit.t.length;
      if ((sinceReport += unit.t.length) >= 8) {
        sinceReport = 0;
        emit('progress', { typed: run.typed, total: run.total });
      }
      await sleep(delayFor(unit.t.length > 1 ? ' ' : unit.t, wpm, jitter));
    }

    const cancelled = run.cancelled;
    emit('done', { typed: run.typed, total: run.total, cancelled });
    run = null;
  }

  // ----------------------------------------------------------------- message

  window.addEventListener('message', ev => {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || msg.source !== FROM_CS) return;

    switch (msg.type) {
      case 'probe':
        emit('probe-result', { adapter: resolveTarget()?.name || null, focused: document.hasFocus() });
        break;
      case 'start':
        if (run) return;
        type(msg.text, msg.opts);
        break;
      case 'pause':
        if (run) { run.paused = !run.paused; emit('paused', { paused: run.paused }); }
        break;
      case 'stop':
        if (run) run.cancelled = true;
        break;
      case 'clock-tick':
        clockWaits.get(msg.id)?.();
        break;
    }
  });

  emit('ready', {});
})();
