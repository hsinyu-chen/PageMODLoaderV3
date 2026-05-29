# Page MOD Loader v3

javascript & css MOD loader from your local file, use any toolchain for MOD develop

## Getting Start
install from chrome web store [here](https://chromewebstore.google.com/detail/page-mod-loader-v3/mkchjogfokebijmjljphfmloimhaimcd)

install from edge add-ons [here](https://microsoftedge.microsoft.com/addons/detail/page-mod-loader-v3/plgigadbfamioehogbacepodfafjlbib)
# **you have to enable development mode in your extension page for this extension to work!**

### 1. create root folder for your MODs

File system access API can't read folder from driver root , so make sure you don't put folder there.

### 2. create a MOD

create a sub folder inside your root folder for your new MOD, and create `config.json` , for example if your root folder at `C:\Users\xxx\OneDrive\WebMODs`
your folder structure should look like following:
```
WebMODs
 └ superCoolMod
    └ config.json
```
### 3. add js or/and css files

you can excute as many scrips or add styles as you need , that's say you need a `index.js` and a `index.css` , just put files in your mod folder like:
```
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

### 5. load MODs

click on extension icon , click `Option` , click `Select Mod Folder` and select your root folder , browser will ask permission to read the folder
you need do this everytime you made changes of your MODs

### 6. tips

you can put any files (like Typescript source code) in the folder , the extension only read files you set in the `config.json`

the `path` in `inject` setting can use nested path like `dist/main/abc.js`

I have created a project template and basic file scaffolding script in [here](mod-template)

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

### Reading options from MOD code

Your MOD reads values, reacts to changes, handles button presses, and pushes dynamic choices /
label text through the `@libs/pml` helpers (`getOptions`, `onOptionChange`, `onButton`,
`setChoices`, `setLabel`). See the **[MOD template README](mod-template/README.md)** for the API and
usage, and **[demo-mods](demo-mods)** for ready-to-load examples (including one that exercises every
control type).

### Without `@libs/pml`

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

## for who want build extension locally

1. clone repo
2. run `npm i` and `npm build` in gui and extension folder
3. load unpackaged extension from `extension_dist` folder 



