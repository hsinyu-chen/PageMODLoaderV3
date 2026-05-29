import {
    Mod, ModDb, UserScriptClean, UserScriptNotify, ModExcutionResultDb,
    ModOptionsDb, ModOptionValues, TabDynamicChoices, TabDynamicLabels, ModOptionChoice,
    STORAGE_MOD_OPTIONS, STORAGE_MOD_OPTIONS_REV,
    MSG_PML_POLL, MSG_PML_CHOICES, MSG_PML_LABEL, MSG_PML_GET_DISPLAY, MSG_PML_LABEL_UPDATE, MSG_PML_BUTTON,
    resolveOptionValue, ownValue
} from "@lib/types";

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
    })
}
function ___pml__inject_style(style: string) {
    const stylee = document.createElement('style');
    stylee.textContent = style;
    document.head.append(stylee);
}
function ___pml__clean(eid: string) {
    chrome.runtime.sendMessage(eid, {
        type: 'clean'
    })
}

function buildScripts(mod: Mod) {
    const js = [{
        code: `${___pml__notify};${___pml__inject_style};${___pml__clean}`
    },
    {
        code: `___pml__clean('${chrome.runtime.id}')`
    }]
    // __PML_EID__/__PML_NAME__ live only in this IIFE closure — never on window — so @libs/pml
    // (inlined into the mod bundle) can reach them while the page cannot read or tamper with them.
    const bootstrap = `const __PML_EID__=${JSON.stringify(chrome.runtime.id)},__PML_NAME__=${JSON.stringify(mod.name)};`;
    for (const file of mod.files) {
        let code = '';
        if (file.type === 'script') {
            code = `${file.content}`;
        } else if (file.type === 'style') {
            const styleParameter = file.content.replace(/"/g, '\\"').replace(/\n|\r\n|\r/g, "\\n");
            code = `___pml__inject_style("${styleParameter}")`;
        }
        js.push({
            code: `
        (async ()=>{
            ${bootstrap}
            try{
                /* user script start */;
                ${code}
                ;/* user script end */
                ___pml__notify('${chrome.runtime.id}','${mod.name}','${file.path}','${file.type}')
            }catch(e){
                console.error(e)
                ___pml__notify('${chrome.runtime.id}','${mod.name}','${file.path}','${file.type}',\`\${e}\`)
            }
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
            const scripts: chrome.userScripts.RegisteredUserScript[] = [];
            for (const [, mod] of Object.entries((values['mods'] ?? {}) as ModDb)) {
                if (mod.enabled) {
                    scripts.push({
                        id: mod.name,
                        matches: typeof mod.match === 'string' ? [mod.match] : mod.match,
                        js: buildScripts(mod),
                        world: 'MAIN',
                        runAt: 'document_end'
                    });
                }
            }
            await chrome.userScripts.unregister();
            if (scripts.length) {
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

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id) {
        tabScriptTracker[tab.id] = {};
    }
})
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabScriptTracker[tabId]
    clearTabOptionState(tabId)
})
// Navigating to a non-modded page sends no 'clean' (no mod runs there), so clear per-tab option
// state on any navigation start to avoid leaking it until the tab closes.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') clearTabOptionState(tabId)
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
    response(tabScriptTracker[request.query])
});
// name/key from the MAIN world index our state objects — reject prototype-polluting values.
function isUnsafeKey(s: unknown): boolean {
    return s !== undefined && (typeof s !== 'string' || s === '__proto__' || s === 'constructor' || s === 'prototype')
}
chrome.runtime.onMessageExternal.addListener((request: any, sender, response) => {
    if (isUnsafeKey(request?.name) || isUnsafeKey(request?.key)) return
    if (request?.type === MSG_PML_POLL) {
        const tabId = sender.tab?.id
        const clientRev: number | null = request.rev
        const clientBtn: number = request.btn ?? 0
        // Subscribe first, then read state: a flush during the async read must not be lost (it
        // would otherwise respond to a not-yet-pushed poller and leave it stuck).
        const poller: Poller = { name: request.name, tabId, respond: response }
        pendingPollers.push(poller)
        void (async () => {
            const { mods, modOptions, rev } = await readOptionState()
            const idx = pendingPollers.indexOf(poller)
            if (idx === -1) return // a flush already responded while we were reading
            // btn compared with !== (not >) so an SW-restart counter reset still wakes the poll
            if (clientRev === null || rev > clientRev || tabButtonTotal(request.name, tabId) !== clientBtn) {
                pendingPollers.splice(idx, 1)
                try { response(snapshotFor(mods, modOptions, rev, poller)) } catch { /* port closed */ }
            }
        })()
        return true // async response: keep the message channel open until a value changes
    }
    if (request?.type === MSG_PML_CHOICES) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
            // choices come from an untrusted page; keep only well-formed {value,label} string
            // pairs so a non-array or malformed item can't break the popup's @for / track
            const choices: ModOptionChoice[] = (Array.isArray(request.choices) ? request.choices : [])
                .filter((c: any) => c && typeof c.value === 'string' && typeof c.label === 'string')
                .map((c: any) => ({ value: c.value, label: c.label }))
            const perMod = (tabDynamicChoices[tabId] ??= {})
            perMod[request.name] = { ...perMod[request.name], [request.key]: choices }
        }
        response({ ok: true }) // close the MV3 message port so the sender's promise doesn't reject
        return
    }
    if (request?.type === MSG_PML_LABEL) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
            const perMod = (tabDynamicLabels[tabId] ??= {})
            perMod[request.name] = { ...perMod[request.name], [request.key]: String(request.text) }
            // live-push to an open popup (no-op if none is listening)
            chrome.runtime.sendMessage({
                type: MSG_PML_LABEL_UPDATE, tabId, mod: request.name, key: request.key, text: String(request.text)
            }).catch(() => { /* no popup open */ })
        }
        response({ ok: true })
        return
    }
    if (request && sender.tab?.id) {
        if (!tabScriptTracker[sender.tab.id] || request.type === 'clean') {
            tabScriptTracker[sender.tab.id] = {}
        }
        // 'clean' fires as a page (re)loads — drop the old page's per-tab option state so dynamic
        // choices, button counts, and dead pollers don't bleed across navigations in the same tab.
        if (request.type === 'clean') {
            clearTabOptionState(sender.tab.id)
        }

        if (request.type === 'userScriptExcute') {
            if (!tabScriptTracker[sender.tab.id][request.name]) {
                tabScriptTracker[sender.tab.id][request.name] = { name: request.name, results: [] }
            }
            const result = tabScriptTracker[sender.tab.id][request.name];

            result.results.push({
                file: request.file,
                type: request.fileType,
                success: !request.error,
                error: request.error
            })
        }
        const count = Object.values(tabScriptTracker[sender.tab.id]).length;
        chrome.action.setBadgeText({
            text: count ? count.toFixed(0) : '',
            tabId: sender.tab.id
        })
    }
})
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
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