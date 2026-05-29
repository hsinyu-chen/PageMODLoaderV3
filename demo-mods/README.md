# Demo MODs

Reference MODs that target <https://www.google.com/>. Each folder is a MOD
(`config.json` + a built `dist/`), so you can load them as-is — no build needed.

| MOD | Shows |
| --- | --- |
| `hello-google` | the simplest MOD: inject a DOM element + CSS, no options API |
| `options-playground` | every option type — toggle / text / dropdown / checklist / **dynamic** dropdown / **label** / **button** — read live via `@libs/pml` |

## Load them

1. Enable developer mode for the extension (required for `chrome.userScripts`).
2. Open the extension's **Options** page (or the popup's **Options** tab) →
   **Select Mod Folder** → pick this `demo-mods` folder.
3. Make sure the MODs are enabled, then open <https://www.google.com/>.
   - `hello-google` shows a banner at the top.
   - `options-playground` shows a floating panel.
4. With the Google tab focused, open the extension **popup** and expand
   `options-playground`. Toggle / type / pick choices / press **Ping** — the panel
   and the **Status** label update live (no reload). The **Jump to link** dropdown
   is filled dynamically from the page's links.

> Value options apply to every matching tab; the button, the label, and the
> dynamic dropdown are per-tab (only the tab you opened the popup on).

## Rebuild after editing a demo's `src/`

The demos build with the template's toolchain:

```sh
cd ../mod-template/template
npm i                       # once
npx rollup -c build-demos.mjs
```

This rebuilds every demo's `dist/`. `@libs/*` resolves to `mod-template/libs`.
