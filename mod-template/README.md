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
  { "key": "refresh", "type": "button",   "label": "Refresh now" }
]
```

Use them from your code:

```ts
import { getOptions, onOptionChange, onButton, setChoices } from '@libs/pml';

const opts = await getOptions();          // read current values once
onOptionChange(v => { /* live updates */ });
onButton('refresh', () => location.reload());
setChoices('sections', [{ value: 'a', label: 'Section A' }]); // fill a dynamic dropdown/checklist
```

Notes:
- `toggle`→boolean, `text`/`dropdown`→string, `checklist`→string[].
- **Value options are global** (apply to every matching tab); **buttons and dynamic choices are per-tab** (only the active tab).
- `dropdown`/`checklist` can set `"dynamic": true` and omit `choices` (or keep them as a fallback); the live list comes from `setChoices`.
