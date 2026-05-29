🔧 Inject custom JavaScript & CSS into any webpage — straight from your local files.

Page MOD Loader v3 lets you develop webpage MODs using your favorite tools (VS Code, Webpack, TypeScript, Sass… anything!) and load them directly from a local folder. No need to write code inside the extension — just point it to your MOD folder and go.

━━━━━━━━━━━━━━━━━━━━━━

✨ Key Features

• 📁 Load MODs from local folders — Use the File System Access API to read scripts and styles from your disk. Your MOD folder is remembered across sessions.
• 🔀 Use any toolchain — Write MODs in TypeScript, Sass, or any language. The extension only reads your build output; your source stays untouched.
• 🎯 URL pattern matching — Target specific websites with flexible match patterns (e.g. https://example.com/*). Supports single or multiple patterns per MOD.
• ⚡ Multiple files per MOD — Inject as many JS and CSS files as you need per MOD, in the order you define.
• 🔛 Toggle MODs on/off — Enable or disable individual MODs without removing them.
• 🎛️ MOD option UI — Let a MOD declare toggles, text fields, dropdowns, multi-selects, buttons and live labels that render in the popup, so users configure it without editing code. Values reach the MOD page-invisibly — never on the page's window or DOM.
• 🔐 Optional encrypted options — Opt a MOD into AES-256-GCM so its option values (e.g. API tokens) travel sealed end-to-end and can't be read by other page scripts.
• 📊 Execution status — See which MODs ran on the current page and whether they succeeded, right from the popup.
• 🔄 One-click re-sync — After editing your MODs locally, just hit "Re Sync" to reload everything.
• 📂 Nested file support — Reference files in subdirectories (e.g. dist/main/bundle.js).

━━━━━━━━━━━━━━━━━━━━━━

🚀 How It Works

1. Create a root folder for your MODs (e.g. C:\Users\you\WebMODs)
2. Add a subfolder for each MOD with a config.json
3. Define which JS/CSS files to inject and which URLs to target
4. Open the extension options → Select Mod Folder → Done!

━━━━━━━━━━━━━━━━━━━━━━

⚠️ Important: Developer Mode must be enabled on your browser's extension page for userScript support.

🔗 Documentation, MOD template & source code:
https://github.com/hsinyu-chen/PageMODLoaderV3

Open source • Manifest V3 • Zero tracking • No data collection