# Page MOD Loader v3 MOD template
with scss and typescript

template project for MODs

## Getting Start

clone this folder

and run `.\create.ps1 -Name [your MOD name]` to create a MOD under MODs folder

edit `config.json` in created folder (change match field as you needed)

run `npm i` in created folder

write your code, I have added a simple tsx dom renderer into it
so you can use 
```tsx
const element = <div>hello</div>;
```
to create element , no need to use document.createElement like
```js
const element = document.createElement('div')
element.textContent = 'hello'
```

after MOD developed , select folder `MODs` in extension option page to upload MODs

## Options UI

A MOD can declare interactive controls in `config.json` under `options`. They render
automatically in the extension popup, and the MOD reads them at runtime via `@libs/pml`.

Declare them (see `config.json` for a full example):

```jsonc
"options": [
  { "key": "enabled", "type": "toggle",   "label": "Enable feature", "default": true },
  { "key": "greeting","type": "text",     "label": "Greeting",       "default": "hi" },
  { "key": "theme",   "type": "dropdown", "label": "Theme", "default": "light",
    "choices": [{ "value": "light", "label": "Light" }, { "value": "dark", "label": "Dark" }] },
  { "key": "sections","type": "checklist","label": "Sections", "default": [], "dynamic": true },
  { "key": "status",  "type": "label",    "label": "Status",   "default": "idle" },
  { "key": "refresh", "type": "button",   "label": "Refresh now" }
]
```

Use them from your code:

```ts
import { getOptions, onOptionChange, onButton, setChoices, setLabel } from '@libs/pml';

const opts = await getOptions();          // read current values once
onOptionChange(v => { /* apply settings */ }); // fires now AND on every change; { immediate:false } to skip the first
onButton('refresh', () => location.reload());
setChoices('sections', [{ value: 'a', label: 'Section A' }]); // fill a dynamic dropdown/checklist
setLabel('status', 'ready');              // update a read-only label (live in an open popup)
```

Notes:
- `toggle`→boolean, `text`/`dropdown`→string, `checklist`→string[].
- `label` is **read-only display**: shows the static `default`, or whatever the mod last passed to `setLabel` (updates live while the popup is open).
- **Value options are global** (apply to every matching tab); **buttons, dynamic choices and labels are per-tab** (only the active tab).
- `dropdown`/`checklist` can set `"dynamic": true` and omit `choices` (or keep them as a fallback); the live list comes from `setChoices`.

### Without `@libs/pml`

`pml.ts` has no dependencies — it only uses `chrome` and two globals the loader injects. If you
don't want the `@libs` path, just copy `libs/pml.ts` into your project. If you'd rather talk to the
extension directly (any toolchain, plain JS), `@libs/pml` is only a thin wrapper over this protocol:

The loader injects two constants into your MOD's scope:

- `__PML_EID__` — the extension id (the message target).
- `__PML_NAME__` — this MOD's name.

All option traffic is `chrome.runtime.sendMessage(__PML_EID__, …)` (page-invisible — it never
touches the page's DOM or `window`):

```js
// Read once / long-poll. rev:null returns the current snapshot immediately; re-send with the
// returned rev (and btn) to block until something changes, then repeat — that is onOptionChange.
const { rev, btn, values } = await chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlPoll', name: __PML_NAME__, rev: null, btn: 0,
});
// values[key] is each option's value; a button's value is a monotonically increasing press count.
// (On SW restart the message port closes → the promise rejects; just re-poll.)

// Provide dynamic dropdown/checklist choices for this tab's popup:
chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlChoices', name: __PML_NAME__, key: 'sections', choices: [{ value: 'a', label: 'A' }],
});

// Set a read-only label's text (live in an open popup):
chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlLabel', name: __PML_NAME__, key: 'status', text: 'ready',
});
```

> In TypeScript without `pml.ts`, add `declare const __PML_EID__: string;` and
> `declare const __PML_NAME__: string;` so the compiler knows about the injected globals.
