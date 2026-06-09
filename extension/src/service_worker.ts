import {
    Mod, ModDb, ModExcutionResultDb,
    ModOptionsDb, ModOptionValues, TabDynamicChoices, TabDynamicLabels, ModOptionChoice,
    STORAGE_MOD_OPTIONS, STORAGE_MOD_OPTIONS_REV, STORAGE_MOD_KEYS, DEFAULT_RUN_AT,
    MSG_PML, MSG_PML_POLL, MSG_PML_CHOICES, MSG_PML_LABEL, MSG_PML_GET_DISPLAY, MSG_PML_LABEL_UPDATE, MSG_PML_BUTTON,
    resolveOptionValue, ownValue
} from "@lib/types";
import { ensureModKeys, keyFor, invalidateKeyCache, cryptoBootstrap, pmlChannel, hasModKey, PmlChannel } from "./pml-channel";

function isUserScriptsAvailable() {
    try {
        // Property access which throws if developer mode is not enabled.
        chrome.userScripts;
        return true;
    } catch {
        // Not available.
        return false;
    }
}
function ___pml__notify(eid: string, name: string, file: string, type: string, error?: any) {
    chrome.runtime.sendMessage(eid, {
        type: 'userScriptExcute',
        name: name,
        file: file,
        fileType: type,
        error: error
    });
}
function ___pml__inject_style(style: string) {
    const stylee = document.createElement('style');
    stylee.textContent = style;
    // At runAt 'document_start' the DOM isn't built yet — document.head is null, so fall back to
    // documentElement, then document itself for an empty doc with no root (the <style> becomes the
    // root node, no throw); CSSOM applies the rules regardless of where the <style> node sits.
    (document.head || document.documentElement || document).append(stylee);
}
// Inlined as an IIFE into each file's bootstrap (the SW never calls it): announce this file's load
// result, then keep announcing on BFCache restore. eid/name come in as params so the call site can
// pass the closure consts (__PML_EID__/__PML_NAME__) instead of re-baking them as literals.
function ___pml__report_and_watch(eid: string, name: string, path: string, type: string, err: unknown) {
    const report = () => ___pml__notify(eid, name, path, type, err);
    report();
    // The SW wipes per-tab state on navigation and a BFCache-restored page is not re-injected, so
    // without re-announcing here the popup would list no mods (options unsettable). The listener
    // survives BFCache with the frozen page; 'persisted' fires only on restore.
    addEventListener('pageshow', e => { if (e.persisted) report(); });
}
// Serialized via toString() into a USER_SCRIPT mod's injected bootstrap (the SW never calls it). In
// that world chrome.runtime.sendMessage(eid, msg) is treated as EXTERNAL messaging, which restrictive
// domains (Gmail) block; dropping a leading own-id arg reroutes the call to the internal
// onUserScriptMessage channel. eid is a parameter because __PML_EID__ lives only in the per-IIFE
// closure, out of this function's scope.
function ___pml__install_messaging_polyfill(eid: string) {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) return;
    // sendMessage is overloaded and we forward arbitrary (possibly arg-stripped) calls, so widen it.
    const _sm = runtime.sendMessage as unknown as (...args: unknown[]) => unknown;
    try {
        Object.defineProperty(runtime, 'sendMessage', {
            value: function (...args: unknown[]) {
                const finalArgs = (args.length > 0 && args[0] === eid) ? args.slice(1) : args;
                return _sm.apply(runtime, finalArgs);
            },
            configurable: true,
            writable: true,
        });
    } catch (e) {
        // A silent failure re-routes messaging back to the external path Gmail blocks — surface it.
        console.warn('[PML] failed to install USER_SCRIPT sendMessage polyfill:', e);
    }
}

function buildScripts(mod: Mod) {
    const js = [{
        code: `${___pml__notify};${___pml__inject_style}`
    }]
    // __PML_EID__/__PML_NAME__ (and, for encrypt mods, the crypto impl + __PML_KEY__ baked by
    // cryptoBootstrap) live only in this IIFE closure — never on window — so @libs/pml (inlined into
    // the mod bundle) can reach them while the page cannot read or tamper with them.
    const isUserScript = mod.world === 'USER_SCRIPT';
    // Inlined as an IIFE (not called by name) so it stays self-contained and name-independent;
    // appended last so it patches sendMessage before @libs/pml captures it or notify runs.
    const polyfill = isUserScript ? `(${___pml__install_messaging_polyfill})(__PML_EID__);` : '';
    const bootstrap = `${cryptoBootstrap(mod)}const __PML_EID__=${JSON.stringify(chrome.runtime.id)},__PML_NAME__=${JSON.stringify(mod.name)};${polyfill}`;
    for (const file of mod.files) {
        let code = '';
        if (file.type === 'script') {
            code = `${file.content}`;
        } else if (file.type === 'style') {
            code = `___pml__inject_style(${JSON.stringify(file.content)})`;
        }
        js.push({
            code: `
        (async ()=>{
            ${bootstrap}
            let __pml_err;
            try{
                /* user script start */;
                ${code}
                ;/* user script end */
            }catch(e){
                console.error(e)
                __pml_err = \`\${e}\`
            }
            (${___pml__report_and_watch})(__PML_EID__, __PML_NAME__, ${JSON.stringify(file.path)}, ${JSON.stringify(file.type)}, __pml_err);
        })();`});

    }
    return js;
}
let registerChain: Promise<void> = Promise.resolve();
function registScripts(): Promise<void> {
    registerChain = registerChain.then(async () => {
        try {
            if (!isUserScriptsAvailable()) return;
            const values = await chrome.storage.local.get('mods')
            const mods = (values['mods'] ?? {}) as ModDb
            await ensureModKeys(mods) // keys must exist before buildScripts bakes them into the closure
            const scripts: chrome.userScripts.RegisteredUserScript[] = [];
            for (const [, mod] of Object.entries(mods)) {
                if (!mod.enabled) continue
                // Fail closed: an encrypt mod whose key didn't materialize is skipped, never registered
                // in a plaintext-capable state. (ensureModKeys should have made the key; this is a guard.)
                if (mod.encrypt && !hasModKey(mod.name)) {
                    console.error(`PML: skipping encrypt mod "${mod.name}" — no key available`)
                    continue
                }
                scripts.push({
                    id: mod.name,
                    matches: typeof mod.match === 'string' ? [mod.match] : mod.match,
                    js: buildScripts(mod),
                    world: mod.world ?? 'MAIN',

                    runAt: mod.runAt ?? DEFAULT_RUN_AT
                });
            }
            await chrome.userScripts.unregister();
            if (scripts.length) {
                if (chrome.userScripts.configureWorld) {
                    try {
                        await chrome.userScripts.configureWorld({ messaging: true });
                    } catch (cwErr) {
                        console.error('configureWorld failed:', cwErr);
                    }
                }
                await chrome.userScripts.register(scripts);
            }
        } catch (e) {
            console.error('registScripts failed:', e);
        }
    });
    return registerChain;
}
const tabScriptTracker: { [id: number]: ModExcutionResultDb } = {}

// --- Mod option long-poll ---
// Values flow page-invisibly: MAIN-world mods pull via external messaging, SW holds the
// response until a value changes (long poll). Button presses and dynamic choices are per-tab
// (keyed by sender.tab.id); value options are global (chrome.storage.local).
type Poller = { name: string, tabId: number | undefined, respond: (msg: any) => void }
const pendingPollers: Poller[] = []
const tabDynamicChoices: TabDynamicChoices = {}
const tabDynamicLabels: TabDynamicLabels = {}
const tabButtonCounters: { [tabId: number]: { [mod: string]: { [key: string]: number } } } = {}

async function readOptionState() {
    const v = await chrome.storage.local.get(['mods', STORAGE_MOD_OPTIONS, STORAGE_MOD_OPTIONS_REV])
    return {
        mods: (v['mods'] ?? {}) as ModDb,
        modOptions: (v[STORAGE_MOD_OPTIONS] ?? {}) as ModOptionsDb,
        rev: (v[STORAGE_MOD_OPTIONS_REV] ?? 0) as number
    }
}
function effectiveValues(mods: ModDb, modOptions: ModOptionsDb, name: string, tabId: number | undefined): ModOptionValues {
    const out: ModOptionValues = {}
    const options = mods[name]?.options ?? []
    const stored = modOptions[name] ?? {}
    const counters = (tabId !== undefined ? tabButtonCounters[tabId]?.[name] : undefined) ?? {}
    for (const option of options) {
        if (option.type === 'label') continue // display-only, mod-pushed; not polled
        out[option.key] = option.type === 'button'
            ? (ownValue(counters, option.key) ?? 0)
            : resolveOptionValue(option, ownValue(stored, option.key))
    }
    return out
}
// Total presses across this mod's buttons on this tab — a volatile wake signal that
// `modOptionsRev` (value-only, durable) does not cover. Resets to 0 when the SW restarts.
function tabButtonTotal(name: string, tabId: number | undefined): number {
    const perKey = tabId !== undefined ? tabButtonCounters[tabId]?.[name] : undefined
    if (!perKey) return 0
    let total = 0
    for (const key in perKey) total += perKey[key]
    return total
}
function snapshotFor(mods: ModDb, modOptions: ModOptionsDb, rev: number, p: Poller) {
    return { rev, btn: tabButtonTotal(p.name, p.tabId), values: effectiveValues(mods, modOptions, p.name, p.tabId) }
}
function flushPollers(predicate: (p: Poller) => boolean): void {
    const drained: Poller[] = []
    for (let i = pendingPollers.length - 1; i >= 0; i--) {
        if (predicate(pendingPollers[i])) drained.push(...pendingPollers.splice(i, 1))
    }
    if (!drained.length) return
    void (async () => {
        const { mods, modOptions, rev } = await readOptionState()
        for (const p of drained) {
            try { p.respond(snapshotFor(mods, modOptions, rev, p)) } catch { /* port closed */ }
        }
    })()
}

function clearTabOptionState(tabId: number): void {
    delete tabDynamicChoices[tabId]
    delete tabDynamicLabels[tabId]
    delete tabButtonCounters[tabId]
    flushPollers(p => p.tabId === tabId)
}

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabScriptTracker[tabId]
    delete tabCurrentDocumentId[tabId]
    clearTabOptionState(tabId)
})
// Cleanup is keyed to navigation, not to "first mod injected" — mods can inject at different
// runAt timings, so a document_end mod must not wipe a document_start mod's already-recorded
// results. The browser-process 'loading' event precedes any mod's renderer-side sendMessage, so
// the reset always lands before the new page's mods repopulate the tracker (via lazy init below).
const tabCurrentDocumentId: Record<number, string> = {}
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Early-clear only on a real top-level URL change. Phantom background 'loading' events, same-URL
    // F5 reloads, and SPA pushState all lack a 'loading'+url pair and are skipped here. Chrome may
    // even split status and url across separate onUpdated events, so this misses some real
    // navigations too — the authoritative reset for those is the sender.documentId mismatch check in
    // handlePMLMessageFromPageOrUserScript (it fires on the new document's first message, before the
    // tracker repopulates).
    if (changeInfo.status !== 'loading' || !changeInfo.url) return

    delete tabScriptTracker[tabId]
    delete tabCurrentDocumentId[tabId]
    clearTabOptionState(tabId)
    chrome.action.setBadgeText({ text: '', tabId })
})
chrome.runtime.onMessage.addListener((request, sender, response) => {
    if (request === 'update') {
        registScripts()
        return
    }
    if (typeof request !== 'object' || request === null) return
    if (request.type === MSG_PML_BUTTON) {
        const { tabId, mod, key } = request as { tabId: number, mod: string, key: string }
        if (typeof tabId === 'number') {
            const perMod = (tabButtonCounters[tabId] ??= {})
            const perKey = (perMod[mod] ??= {})
            perKey[key] = (perKey[key] ?? 0) + 1
            flushPollers(p => p.tabId === tabId)
        }
        return
    }
    if (request.type === MSG_PML_GET_DISPLAY) {
        const tabId = (request as { tabId: number }).tabId
        response({ choices: tabDynamicChoices[tabId] ?? {}, labels: tabDynamicLabels[tabId] ?? {} })
        return
    }
    const handled = handlePMLMessageFromPageOrUserScript(request, sender, response)
    if (handled) return true
    if (request.query !== undefined) {
        response(tabScriptTracker[request.query])
    }
});

chrome.runtime.onMessageExternal.addListener(handlePMLMessageFromPageOrUserScript)
if (chrome.runtime.onUserScriptMessage) {
    chrome.runtime.onUserScriptMessage.addListener(handlePMLMessageFromPageOrUserScript)
}

// name/key from the MAIN world index our state objects — reject prototype-polluting values.
function isUnsafeKey(s: unknown): boolean {
    return s !== undefined && (typeof s !== 'string' || s === '__proto__' || s === 'constructor' || s === 'prototype')
}

// Every option/UI message — sealed envelope (MSG_PML) for an encrypt mod, or the bare type for a
// plaintext one. The channel decides which it accepts; the inner type drives the dispatch.
const PML_TYPES: ReadonlySet<string> = new Set([MSG_PML, MSG_PML_POLL, MSG_PML_CHOICES, MSG_PML_LABEL])

function dispatchPml(inner: any, name: string, tabId: number | undefined, channel: PmlChannel, response: (msg?: any) => void): void {
    // Every PML message is per-tab; a tab-less sender can't be served and its poller would never be
    // cleared by clearTabOptionState. Drop and close the port. (Guarded once: tabId is number below.)
    if (typeof tabId !== 'number') { response(); return }
    if (isUnsafeKey(inner?.key)) { response(); return } // inner.key was sealed; close the held port on drop
    if (inner.type === MSG_PML_POLL) {
        const clientRev: number | null = inner.rev ?? null
        const clientBtn: number = inner.btn ?? 0
        // Subscribe first, then read state: a flush during the async read must not be lost (it
        // would otherwise respond to a not-yet-pushed poller and leave it stuck). respond seals
        // through the channel, so an encrypt mod's values never leave the SW in the clear.
        const poller: Poller = { name, tabId, respond: (snapshot) => { try { response(channel.seal(snapshot)) } catch { /* port closed */ } } }
        pendingPollers.push(poller)
        void (async () => {
            const { mods, modOptions, rev } = await readOptionState()
            const idx = pendingPollers.indexOf(poller)
            if (idx === -1) return // a flush already responded while we were reading
            // btn compared with !== (not >) so an SW-restart counter reset still wakes the poll
            if (clientRev === null || rev > clientRev || tabButtonTotal(name, tabId) !== clientBtn) {
                pendingPollers.splice(idx, 1)
                poller.respond(snapshotFor(mods, modOptions, rev, poller))
            }
        })()
        return
    }
    if (inner.type === MSG_PML_CHOICES) {
        if (typeof inner.key !== 'string' || !inner.key) { response(); return } // no key ⇒ would index state by "undefined"
        // choices come from an untrusted page; keep only well-formed {value,label} string pairs so
        // a non-array or malformed item can't break the popup's @for / track
        const choices: ModOptionChoice[] = (Array.isArray(inner.choices) ? inner.choices : [])
            .filter((c: any) => c && typeof c.value === 'string' && typeof c.label === 'string')
            .map((c: any) => ({ value: c.value, label: c.label }))
        const perMod = (tabDynamicChoices[tabId] ??= {})
        perMod[name] = { ...perMod[name], [inner.key]: choices }
        response({ ok: true }) // ack closes the MV3 port so the sender's promise doesn't reject
        return
    }
    if (inner.type === MSG_PML_LABEL) {
        if (typeof inner.key !== 'string' || !inner.key) { response(); return }
        const perMod = (tabDynamicLabels[tabId] ??= {})
        perMod[name] = { ...perMod[name], [inner.key]: String(inner.text) }
        // live-push to an open popup (no-op if none is listening)
        chrome.runtime.sendMessage({
            type: MSG_PML_LABEL_UPDATE, tabId, mod: name, key: inner.key, text: String(inner.text)
        }).catch(() => { /* no popup open */ })
        response({ ok: true })
        return
    }
    response({ ok: true }) // unknown inner type — close the port
}

function handlePMLMessageFromPageOrUserScript(request: any, sender: chrome.runtime.MessageSender, response: (msg?: any) => void) {
    if (isUnsafeKey(request?.name) || isUnsafeKey(request?.key)) return
    if (request && PML_TYPES.has(request.type)) {
        const name: string = request.name
        if (typeof name !== 'string' || !name) { response(); return } // a poll without a name registers a poller keyed undefined
        const tabId = sender.tab?.id
        // keyFor decides the mode: a keyed mod accepts only the sealed envelope, an unkeyed one only
        // plaintext — a mismatched message opens to null and is dropped (no plaintext downgrade).
        void (async () => {
            try {
                const key = await keyFor(name)
                // Fail closed: if the mod is configured encrypt but no key loaded (cold start / storage
                // glitch), refuse rather than fall back to a plaintext channel a page could poll in the clear.
                if (!key) {
                    const { mods } = await readOptionState()
                    if (ownValue(mods, name)?.encrypt) { response(); return }
                }
                const channel = pmlChannel({ key })
                const inner = channel.open(request)
                if (inner) dispatchPml(inner, name, tabId, channel, response)
                else response() // dropped (downgrade / tampered / garbage) — close the held port, don't leak it
            } catch (e) {
                // a throw here (e.g. hexToBytes on a corrupt stored key) would otherwise reject
                // silently and leave the held port open until Chrome reaps it
                console.error('PML message handling failed:', e)
                try { response() } catch { /* port already closed */ }
            }
        })()
        return true // async: key lookup + (for poll) held until a value changes
    }
    if (request && sender.tab?.id) {
        const docId = sender.documentId;
        if (docId && tabCurrentDocumentId[sender.tab.id] !== docId) {
            tabCurrentDocumentId[sender.tab.id] = docId;
            delete tabScriptTracker[sender.tab.id];
            clearTabOptionState(sender.tab.id);
        }
        // Lazy init for a tab the SW didn't see navigate (e.g. SW restarted mid-page); navigation
        // resets are handled in tabs.onUpdated.
        if (!tabScriptTracker[sender.tab.id]) {
            tabScriptTracker[sender.tab.id] = {}
        }
        
        if (request.type === 'userScriptExcute') {
            if (!tabScriptTracker[sender.tab.id][request.name]) {
                tabScriptTracker[sender.tab.id][request.name] = { name: request.name, results: [] }
            }
            const result = tabScriptTracker[sender.tab.id][request.name];
            const entry = {
                file: request.file,
                type: request.fileType,
                success: !request.error,
                error: request.error
            }
            // Overwrite in place keyed by file+type: a mod re-announces itself on BFCache restore
            // (see buildScripts' pageshow handler), so a blind push would duplicate every result.
            const i = result.results.findIndex(r => r.file === entry.file && r.type === entry.type)
            if (i === -1) result.results.push(entry); else result.results[i] = entry
        }
        const count = Object.values(tabScriptTracker[sender.tab.id]).length;
        chrome.action.setBadgeText({
            text: count ? count.toFixed(0) : '',
            tabId: sender.tab.id
        })
    }
}
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes[STORAGE_MOD_KEYS]) invalidateKeyCache()
    if (changes[STORAGE_MOD_OPTIONS] || changes[STORAGE_MOD_OPTIONS_REV]) {
        flushPollers(() => true)
    }
})
chrome.runtime.onInstalled.addListener(details => {
    if (
        details.reason === chrome.runtime.OnInstalledReason.INSTALL ||
        details.reason === chrome.runtime.OnInstalledReason.UPDATE
    ) {
        registScripts();
    }
});
chrome.runtime.onStartup.addListener(() => {
    registScripts();
});
registScripts();