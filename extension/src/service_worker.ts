import { Mod, ModDb, UserScriptClean, UserScriptNotify, ModExcutionResultDb } from "@lib/types";

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
async function registScripts() {
    if (isUserScriptsAvailable()) {
        await chrome.userScripts.unregister();
        const values = await chrome.storage.local.get('mods')
        if (values['mods']) {
            for (const [, mod] of Object.entries(values['mods'] as ModDb)) {
                if (mod.enabled) {
                    chrome.userScripts.register([{
                        id: mod.name,
                        matches: typeof mod.match === 'string' ? [mod.match] : mod.match,
                        js: buildScripts(mod),
                        world: 'MAIN',
                        runAt: 'document_end'
                    }]);
                }
            }
        }
    }
}
const tabScriptTracker: { [id: number]: ModExcutionResultDb } = {}
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id) {
        tabScriptTracker[tab.id] = {};
    }
})
chrome.tabs.onRemoved.addListener((tab) => {
    delete tabScriptTracker[tab]
})
chrome.runtime.onMessage.addListener((request, sender, response) => {
    if (request === 'update') {
        registScripts()
    } else if (typeof request === 'object') {
        response(tabScriptTracker[request.query])
    }
});
chrome.runtime.onMessageExternal.addListener((request: UserScriptNotify | UserScriptClean, sender, response) => {
    if (request && sender.tab?.id) {
        if (!tabScriptTracker[sender.tab.id] || request.type === 'clean') {
            tabScriptTracker[sender.tab.id] = {}
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
chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        registScripts();
    }
});