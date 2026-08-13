# Code Typer

A Chrome/Edge extension (Manifest V3) that types a snippet into whatever editor is
focused on the page, character by character, at a configurable speed. Built for
recording screencasts and walkthroughs where a paste looks wrong.

## Install

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Pin the extension so the popup is one click away

Requires Chrome/Edge 111+ (the `world: "MAIN"` content script).

## Use

Paste code into the popup, set the speed, hit **Start typing**, then click into the
target editor during the countdown.

| | |
|---|---|
| `Alt+Shift+T` | replay the saved snippet |
| `Alt+Shift+P` | pause / resume |
| `Esc` | stop |

The popup's top-right corner shows which adapter matched the current page —
`monaco`, `codemirror6`, `ace`, and so on — or `no editor found`.

## How insertion works

Each editor gets an adapter in [src/engine.js](src/engine.js):

| Adapter | Matches | Insert path |
|---|---|---|
| `monaco` | `.monaco-editor` | `editor.executeEdits()` |
| `codemirror6` | `.cm-editor` | `view.dispatch({changes})` |
| `codemirror5` | `.CodeMirror` | `cm.replaceSelection()` |
| `ace` | `.ace_editor` | `editor.insert()` |
| `textarea` | `<textarea>`, text `<input>` | native value setter + `input` event |
| `contenteditable` | `[contenteditable]` | `execCommand('insertText')` |

Two decisions worth knowing about:

**Programmatic edits, not synthetic keystrokes.** Dispatching `KeyboardEvent`s makes
the host editor re-indent, auto-close brackets, and expand snippets as the text
arrives, so a block of code lands mangled. Going through each editor's own edit API
skips all of that and the snippet appears exactly as written.

**Adapter order.** Monaco and CodeMirror 5 park focus on a hidden `<textarea>`, and
CodeMirror 6 on a contenteditable. The rich adapters are probed before the generic
ones so a run doesn't end up in an editor's internal scratch element.

Textarea insertion goes through `Object.getOwnPropertyDescriptor(proto, 'value').set`
rather than `el.value = …`, because React's controlled inputs ignore a direct
assignment and revert on the next render.

## Frames

Editors on LeetCode and HackerRank often live in an iframe, so the content script
runs in all frames. A run is broadcast to every frame and the one holding focus
claims it ([src/background.js](src/background.js)); if none does within 400 ms, the
top frame takes it and the engine falls back to the first visible editor. The
progress HUD always renders in frame 0.

## Tuning

- **Speed** is in words per minute at the usual 5-characters-per-word convention.
  300–450 reads as a fast, fluent developer; above ~600 it stops looking typed.
- **Variation** is the ± spread applied per character. 0 is metronomic and reads as
  machine-generated; 30–40% looks natural.
- **Insert indentation in one step** emits a line's leading whitespace as a single
  edit, the way indentation appears when a person presses Tab. Turn it off to type
  indentation space by space.

Newlines, `;` and braces get a slightly longer beat than letters — that rhythm is
what makes playback read as typing rather than as a progress bar.

## Scope

This types into editors that accept input normally. It has no paste-restriction
circumvention, no focus-loss masking, and nothing else aimed at proctored
assessments — don't extend it in that direction.
