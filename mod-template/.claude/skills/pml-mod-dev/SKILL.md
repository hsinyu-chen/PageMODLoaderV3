---
name: pml-mod-dev
description: Develop, build, and configure MODs for the Page MOD Loader v3 extension.
---

# PML MOD Development Skill

How to develop, build, and configure MODs for the Page MOD Loader v3 browser extension.

Loader & template source: https://github.com/hsinyu-chen/PageMODLoaderV3

## MOD Structure
A MOD is a folder (created from `template/`) with:
- `src/index.tsx`: entry point (TypeScript, optional JSX).
- `src/index.scss`: styles (only if the MOD has styles — see JSX Factory §).
- `config.json`: match patterns + inject list (+ optional `options[]` UI and `encrypt` flag — see MOD Options & UI).
- `package.json`, `rollup.config.js`, `tsconfig.json`, `tsconfig.build.json`: build config (esbuild toolchain).
- `dist/`: build output (`index.js`, optionally `index.css`).

Shared code lives in the template's `libs/` and is imported via the `@libs/*` alias (`@libs/helpers`, `@libs/pml`).

## Workflow

### 1. Create a MOD
From the template root, scaffold a new MOD into `MODs/<name>/`:
```powershell
.\create.ps1 -Name "mod-name"     # Windows (robocopy may report exit 1 on success — ignore if files copied)
```
This copies `template/` → `MODs/<name>/` and sets the new `package.json` name.

### 2. Install & build (per MOD)
Each MOD is a standalone npm project — install and build inside its own folder:
```bash
cd MODs/mod-name
npm i
npm run build       # rollup + esbuild → dist/index.js (+ dist/index.css if styles)
npm run typecheck   # optional: tsc --noEmit
```

### 3. Configure (`config.json`)
**`match`** — passed verbatim to `chrome.userScripts.register({ matches })`, so it's a **standard [Chrome match pattern](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)** (not glob, not regex). `*` in the path matches any string incl. `/`. `"https://example.com/*"` covers all paths under it. Accepts a single string or an array.

**`inject`** — files to inject:
```json
"inject": [
    { "path": "dist/index.js", "type": "script" },
    { "path": "dist/index.css", "type": "style" }
]
```
**If a referenced file doesn't exist on disk, the whole MOD fails to load** (not silently skipped) — so a MOD with no styles must remove the `dist/index.css` entry, not leave it.

**`runAt`** (optional) — injection timing, passed straight to `chrome.userScripts`. One of `"document_start"`, `"document_end"` (default), `"document_idle"`. Use `"document_start"` to run before the page's own scripts (e.g. to hook `window.fetch` before the page captures it) — but at that point the DOM isn't built yet, so guard any `document.body`/`querySelector` access (wait for `DOMContentLoaded` if you need the DOM).

### 4. Load in the extension
In the extension's **Options** page → **Select Mod Folder** → pick the folder that contains your MOD folder(s). Subsequent rebuilds are picked up on the next page load; re-select / re-sync if a MOD's `config.json` changed.

> Page MOD Loader uses the `chrome.userScripts` API, so the browser's extension **Developer Mode must be enabled** for MODs to run.

## MOD Options & UI
A MOD can declare interactive controls in `config.json` under `options[]`; the loader renders them in the extension popup so users configure the MOD without editing code. Read/observe them from MOD code via `@libs/pml`. Values travel **page-invisibly** — never on the page's `window` or DOM.

**Declare (`config.json`):**
```json
"options": [
  { "key": "enabled", "type": "toggle",    "label": "Enable",  "default": true },
  { "key": "title",   "type": "text",      "label": "Title",   "default": "hi" },
  { "key": "theme",   "type": "dropdown",  "label": "Theme",   "default": "light",
    "choices": [ { "value": "light", "label": "Light" }, { "value": "dark", "label": "Dark" } ] },
  { "key": "parts",   "type": "checklist", "label": "Parts",   "default": [], "choices": [] },
  { "key": "links",   "type": "dropdown",  "label": "Link",    "dynamic": true },
  { "key": "status",  "type": "label",     "label": "Status",  "default": "idle" },
  { "key": "refresh", "type": "button",    "label": "Refresh" }
]
```
Types: `toggle` (bool) · `text`/`dropdown` (string) · `checklist` (string[]) · `button` (action) · `label` (read-only display). A `dropdown`/`checklist` may set `"dynamic": true` and have the MOD supply `choices` at runtime (keep static `choices` as a fallback or omit). Value options are **global** (every matching tab); button presses, dynamic choices and label text are **per-tab** (the popup's active tab).

**Consume (`@libs/pml`, runs in the page):**
```ts
import { getOptions, onOptionChange, onButton, setChoices, setLabel } from '@libs/pml';
const o = await getOptions();                 // one-off snapshot; a button key reads as its press count
onOptionChange(v => apply(v));                // fires once on load AND on every change; { immediate:false } skips the load fire
onButton('refresh', () => location.reload()); // per-tab; fires on each popup press
setChoices('links', [{ value: 'a', label: 'A' }]); // feed a dynamic dropdown/checklist
setLabel('status', 'ready');                  // update a read-only label live in an open popup
```
`onOptionChange` firing on load + change (Wallpaper-Engine style) means one handler applies settings initially and live.

**Encryption (optional):** set top-level `"encrypt": true` in `config.json` to seal the MOD's entire option/UI channel with AES-256-GCM (per-mod key baked into the MOD's private closure — other page scripts can't read the values). Costs ~10.5 kB of injected code; off by default. The `@libs/pml` API is identical either way. Use it when an option holds a secret (e.g. an API token).

`pml.ts` is dependency-free — to use options without the `@libs` path, copy `libs/pml.ts` into your project, or talk to the loader directly via the raw message protocol (documented in the repo's main README).

## Development Details

### Execution Context
- MODs run via `chrome.userScripts.register(...)` with `world: 'MAIN'`, `runAt: 'document_end'` (configurable per MOD via `config.json` `runAt` — see Configure §).
- So MOD code runs in the **page's main world** — it shares `window`, `document`, the page's `fetch`, event listeners, etc.
  - You can hook `window.fetch` to intercept the page's real requests.
  - Capture-phase listeners (`addEventListener(..., true)`) run before the page's own handlers.
  - Globals you set on `window` are visible to the page — **namespace them** (`window.__myModState`).
- You are NOT an isolated-world content script: you don't have `chrome.*` APIs, you're just a script on the page.

### SPA Navigation
- `chrome.userScripts` injects **once per navigation-based page load**; `history.pushState` / SPA routing does **not** re-inject.
- Your script keeps running across SPA transitions — listen for changes yourself: `MutationObserver` on `document.body`, or patch `history.pushState`/`replaceState` / listen for `popstate`.
- Hooking `window.fetch` once at load survives all SPA transitions (it's on the persistent `window`).

### JSX Factory
A lightweight factory that creates **real DOM elements** (no virtual DOM, no React).
- `_html` from `@libs/helpers`, configured in `tsconfig.json` as `"jsxFactory": "_html"`, `"jsx": "react"`.
  ```tsx
  import { _html } from '@libs/helpers';
  const el = <div class="x">Hi</div>; // real HTMLDivElement
  document.body.appendChild(el);
  ```
- Use `class` (not `className`); the node is a plain DOM element — use DOM APIs.
- A `.tsx` file with no JSX: drop the `import { _html }` line but keep the `.tsx` extension.
- A MOD with no styles: remove `import './index.scss'`, delete `src/index.scss`, **and** remove the `dist/index.css` entry from `config.json` (else the MOD fails to load).

### Shared Libraries
- `@libs/*` resolves to the template's `libs/` (via `tsconfig.json` paths + the rollup alias).
- `_html` in `@libs/helpers`; the option/UI API in `@libs/pml`.
- Add reusable utilities to `libs/`.

### Best Practices
- **Isolation:** one MOD = one site / one purpose.
- **Idempotence:** `MutationObserver` callbacks run constantly — guard against re-work.
- **Performance:** no heavy frameworks; use `_html`.
- **Error handling:** wrap top-level logic in try/catch; never break the host page.
- **Namespacing:** prefix any `window` globals with the MOD name.
