Page MOD Loader v3 lets users inject their OWN local JavaScript/CSS into web pages they choose. Every "mod" is authored and supplied by the user from a local folder — the extension ships and downloads no remote code.

Permissions:

- userScripts: core feature — runs the user's local JS on pages that match the user's own rules.
- host_permissions (*://*/*) + externally_connectable: a mod's target site is user-defined and may be any site, so broad host access is required; injected pages message the extension to report execution results.
- storage + unlimitedStorage: cache the user's mod files locally (can be large).
- tabs: show per-tab injection results in the popup.
- File System Access API: reads mod files from a user-picked local folder (user grants access via the OS folder picker).

REQUIRED to enable (otherwise the extension does nothing):

1. On the extension's details page, turn on Developer mode / "Allow user scripts", then FULLY restart the browser. On Edge, toggling alone does not rebind the userScripts API to the service worker.

How to test:

1. Create a folder NOT at a drive root (File System Access can't read a drive root), e.g. C:\WebMODs
2. Inside it create a subfolder "demo" with two files:
   config.json:
   {"match":"<https://example.com/*","inject":[{"path":"index.js","type":"script"}]}>
   index.js:
   document.body.insertAdjacentHTML('afterbegin','<div style="background:red;color:#fff;padding:8px">PML works</div>');
3. Click the extension icon, open the Options page (desktop: the "Options" tab; or click "Open Option Page"), click "Select Mod Folder", choose C:\WebMODs, and allow read access.
4. Open <https://example.com/> — a red "PML works" banner appears at the top, confirming injection.

Note: on mobile Edge, the options page has no menu entry and the in-popup picker can hang, so use the "Open Option Page" button in the popup to select the folder.
