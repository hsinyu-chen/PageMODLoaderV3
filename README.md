# Page MOD Loader v3

javascript & css MOD loader from your local file, use any toolchain for MOD develop

## Getting Started

install from [Chrome Web Store](https://chromewebstore.google.com/detail/page-mod-loader-v3/mkchjogfokebijmjljphfmloimhaimcd)

install from [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/page-mod-loader-v3/plgigadbfamioehogbacepodfafjlbib)

**you have to enable development mode in your extension page for this extension to work!**

### 1. create root folder for your MODs

File system access API can't read folder from driver root , so make sure you don't put folder there.

### 2. create a MOD

create a sub folder inside your root folder for your new MOD, and create `config.json` , for example if your root folder at `C:\Users\xxx\OneDrive\WebMODs`
your folder structure should look like following:

```text
WebMODs
 └ superCoolMod
    └ config.json
```

### 3. add js or/and css files

you can excute as many scrips or add styles as you need , that's say you need a `index.js` and a `index.css` , just put files in your mod folder like:

```text
WebMODs
 └ superCoolMod
    ├ index.js
    ├ index.css
    └ config.json
```

### 4. setup config.json

open `config.json` , the  schema in the config should like following:

```json
{
    "match":"https://xxx.net/*",
    "inject": [
        {
            "path": "index.js",
            "type": "script"
        },
        {
            "path": "index.css",
            "type": "style"
        }
    ]
}
```

the `match` field can be string or array, for the match syntax , please see : [Match patterns(google dev)](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
the script and style will inject(excute) to page sames as the order you put in the `inject` array

optionally add a top-level `"runAt"` field to control injection timing — one of `"document_start"`, `"document_end"` (default), or `"document_idle"`. Pick `"document_start"` to run before the page's own scripts (e.g. to hook `window.fetch` early); note the DOM isn't built yet at that point, so guard any DOM access.

optionally add a top-level `"world"` field to control the execution environment — one of `"MAIN"` (default) or `"USER_SCRIPT"`. Pick `"USER_SCRIPT"` to run your MOD in an isolated JavaScript environment that bypasses the page's Content Security Policy (CSP). This ensures your script won't be blocked by strict CSP rules, while still retaining full access to read and modify the page's DOM.

### 5. load MODs

click on extension icon , click `Option` , click `Select Mod Folder` and select your root folder , browser will ask permission to read the folder
you need do this everytime you made changes of your MODs

### 6. tips

you can put any files (like Typescript source code) in the folder , the extension only read files you set in the `config.json`

the `path` in `inject` setting can use nested path like `dist/main/abc.js`

I have created a project template and basic file scaffolding script in [mod-template](mod-template)

## Options UI

A MOD can declare interactive controls in `config.json` under `options` (optional). They render
automatically in the extension popup — both in the **Current Page** tab, under the MOD that ran,
and in the **Options** tab — so users can configure the MOD without touching its code.

```json
{
    "match": "https://xxx.net/*",
    "inject": [ { "path": "dist/index.js", "type": "script" } ],
    "options": [
        { "key": "enabled",  "type": "toggle",    "label": "Enable feature", "default": true },
        { "key": "greeting", "type": "text",      "label": "Greeting",       "default": "hi" },
        { "key": "theme",    "type": "dropdown",  "label": "Theme", "default": "light",
          "choices": [ { "value": "light", "label": "Light" }, { "value": "dark", "label": "Dark" } ] },
        { "key": "sections", "type": "checklist", "label": "Sections", "default": [],
          "choices": [ { "value": "a", "label": "A" }, { "value": "b", "label": "B" } ] },
        { "key": "links",    "type": "dropdown",  "label": "Pick a link", "dynamic": true },
        { "key": "status",   "type": "label",     "label": "Status", "default": "idle" },
        { "key": "refresh",  "type": "button",    "label": "Refresh" }
    ]
}
```

Control types: `toggle` (boolean), `text` / `dropdown` (string), `checklist` (string[]),
`label` (read-only text), `button` (action). A `dropdown` / `checklist` can set `"dynamic": true`
to have the MOD fill its choices at runtime (omit or keep `choices` as a fallback).

- **Value options** (toggle / text / dropdown / checklist) are global — they apply to every matching tab.
- **Button, label, and dynamic choices** are per-tab — they target the page the popup was opened on.

### Encrypting the channel (optional)

Option values can hold secrets (an API token in a `text` option, say). The page-invisible channel
already keeps them off the DOM and `window`, but any page script can call `chrome.runtime.sendMessage`
against the extension, so a determined page could poll for another MOD's values. Set `"encrypt": true`
at the top level of `config.json` to close that:

```json
{ "match": "https://xxx.net/*", "encrypt": true, "inject": [ … ], "options": [ … ] }
```

When on, the loader bakes a per-MOD AES-256-GCM key (and the cipher impl) into the MOD's private
closure — never on `window` — and the **entire** option/UI channel is sealed end to end. A page script
that intercepts the messages only sees ciphertext it can't read, and the service worker refuses to
serve this MOD's values in the clear. Cost: ~10.5 kB of injected code per MOD, and it works on plain
`http` pages too (no `crypto.subtle` dependency). Leave it off (default) for secret-free MODs to stay
lean. The `@libs/pml` API is identical either way — the helper detects the mode automatically.

### Reading options from MOD code

Your MOD reads values, reacts to changes, handles button presses, and pushes dynamic choices /
label text through the `@libs/pml` helpers:

```ts
import { getOptions, onOptionChange, onButton, setChoices, setLabel } from '@libs/pml';

const o = await getOptions();                 // one-off snapshot; o[key] is each option's value
onOptionChange(v => apply(v));                // fires once on load AND on every later change
onButton('refresh', () => location.reload()); // per-tab; fires on each popup press
setChoices('links', [{ value: 'a', label: 'A' }]); // fill a "dynamic": true dropdown/checklist
setLabel('status', 'ready');                  // update a read-only label, live in an open popup
```

`getOptions()` is the common case — read the current values once (a button key reads as its press
count); `onOptionChange` firing on load *and* on change lets one handler apply settings initially and
live. See the **[MOD template README](mod-template/README.md)** and **[demo-mods](demo-mods)** for
fuller examples (including one that exercises every control type).

### Without `@libs/pml`

> **Recommended: use `@libs/pml`.** It owns the lifecycle edge cases for you — re-polling on a
> service-worker restart *and* on a BFCache restore, re-pushing dynamic choices/labels, plus the
> encryption envelope. Reach for the raw protocol below only when you genuinely can't bundle the
> helper (no build step, or a non-JS toolchain).

You don't have to use the helper. `pml.ts` is dependency-free (just `chrome` + two injected
globals), so you can copy `mod-template/libs/pml.ts` into any project. To talk to the extension
directly (any toolchain, plain JS), the helper is only a thin wrapper over this page-invisible
message protocol.

The loader injects two constants into your MOD's scope:

- `__PML_EID__` — the extension id (the message target).
- `__PML_NAME__` — this MOD's name.

All option traffic is `chrome.runtime.sendMessage(__PML_EID__, …)` — it never touches the page's
DOM or `window`:

```js
// rev:null returns the current snapshot immediately; re-send with the returned rev (and btn) to
// block until something changes, then repeat — that is onOptionChange.
const { rev, btn, values } = await chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlPoll', name: __PML_NAME__, rev: null, btn: 0,
});
// values[key] is each option's value; a button's value is a monotonically increasing press count.
// (On SW restart the message port closes → the promise rejects; just re-poll.)
// (Same after a BFCache restore — pageshow with event.persisted severs the held poll; re-poll then
//  and re-send your pmlChoices/pmlLabel to resume. @libs/pml does this for you.)

// Provide dynamic dropdown/checklist choices for this tab's popup:
chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlChoices', name: __PML_NAME__, key: 'sections', choices: [{ value: 'a', label: 'A' }],
});

// Set a read-only label's text (live in an open popup):
chrome.runtime.sendMessage(__PML_EID__, {
  type: 'pmlLabel', name: __PML_NAME__, key: 'status', text: 'ready',
});
```

In TypeScript, add `declare const __PML_EID__: string;` and `declare const __PML_NAME__: string;`
so the compiler knows about the injected globals.

**If the MOD sets `"encrypt": true`**, the wire shape changes: every message is wrapped as
`{ type: 'pml', name: __PML_NAME__, enc }` where `enc` is the hex of `iv(12) ‖ AES-256-GCM(JSON(inner))`,
and `inner` is the object you'd otherwise send (e.g. `{ type: 'pmlPoll', rev, btn }`). The poll
response comes back as `{ enc }` sealing `{ rev, btn, values }`. The loader injects the per-MOD key as
`__PML_KEY__` (a `Uint8Array`) and the cipher as `__pmlCrypto` (`{ pmlSeal, pmlOpen }`) into the same
private closure, so a no-helper consumer seals with `__pmlCrypto.pmlSeal(__PML_KEY__, inner)` and opens
the response with `__pmlCrypto.pmlOpen(__PML_KEY__, enc)`. The service worker rejects any plaintext
message for an encrypted MOD (no downgrade). Copying `pml.ts` handles all of this for you.

## For those who want to build the extension locally

1. Clone repo
2. Run `npm i` and `npm build` in gui and extension folder
3. Load unpackaged extension from `extension_dist` folder
