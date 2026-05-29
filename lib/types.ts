
export type InjectFileType = 'script' | 'style'

export type ModOptionType = 'toggle' | 'text' | 'dropdown' | 'checklist' | 'button' | 'label'
export type ModOptionChoice = { value: string, label: string }
export type ModOption = {
    key: string,
    type: ModOptionType,
    label: string,
    default?: boolean | string | string[],
    choices?: ModOptionChoice[],
    dynamic?: boolean
}
// number = button press counter; the rest are option values
export type ModOptionValue = boolean | string | string[] | number
export type ModOptionValues = { [key: string]: ModOptionValue }
export type ModOptionsDb = { [modName: string]: ModOptionValues }
export type ModDynamicChoices = { [modName: string]: { [key: string]: ModOptionChoice[] } }
export type TabDynamicChoices = { [tabId: number]: ModDynamicChoices }
export type ModDynamicLabels = { [modName: string]: { [key: string]: string } }
export type TabDynamicLabels = { [tabId: number]: ModDynamicLabels }
// popup's one-shot fetch of a tab's mod-pushed display state
export type ModDisplayState = { choices: ModDynamicChoices, labels: ModDynamicLabels }

export const STORAGE_MOD_OPTIONS = 'modOptions'
export const STORAGE_MOD_OPTIONS_REV = 'modOptionsRev'
// Per-mod AES-256-GCM keys: { [modName]: base64(32 bytes) }. Baked into each mod's injected
// closure so the whole mod↔SW UI channel is encrypted; never exposed to the page.
export const STORAGE_MOD_KEYS = 'modKeys'
// Envelope type for every encrypted mod↔SW message: { type: MSG_PML, name, enc }. The real
// message ({ type: MSG_PML_POLL|CHOICES|LABEL, ... }) travels sealed inside `enc`; `name` stays
// cleartext as the key selector for SW routing.
export const MSG_PML = 'pml'
export const MSG_PML_POLL = 'pmlPoll'
export const MSG_PML_CHOICES = 'pmlChoices'
export const MSG_PML_LABEL = 'pmlLabel'
export const MSG_PML_GET_DISPLAY = 'pmlGetDisplay'
export const MSG_PML_LABEL_UPDATE = 'pmlLabelUpdate'
export const MSG_PML_BUTTON = 'pmlButton'

// Shared so an unconfigured checklist returns a stable reference — a fresh [] each call would
// look like a changed value to Angular's [ngModel] every digest. Never mutated by callers.
// Own-property read: an option key that collides with an Object.prototype member (toString,
// valueOf, …) would otherwise return the inherited function instead of undefined.
export function ownValue<T>(obj: Record<string, T>, key: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

const EMPTY_CHECKLIST: readonly string[] = Object.freeze([])

export function resolveOptionValue(option: ModOption, stored: ModOptionValue | undefined): ModOptionValue {
    if (option.type === 'button') return typeof stored === 'number' ? stored : 0
    if (stored !== undefined) return stored
    if (option.default !== undefined) return option.default
    return option.type === 'toggle' ? false : option.type === 'checklist' ? (EMPTY_CHECKLIST as string[]) : ''
}

export type ModelConfig = {
    match: string,
    inject: { path: string, type: InjectFileType }[],
    options?: ModOption[],
    // Opt in to encrypting this mod's entire option/UI channel (AES-256-GCM). Costs ~10.5kb of
    // injected bootstrap; off by default so secret-free mods stay lean.
    encrypt?: boolean
}
export type ModFile = {
    file: string
    path: string
    content: string
    type: string
}
export type Mod = {
    enabled: boolean,
    name: string,
    match: string | string[],
    files: ModFile[],
    options?: ModOption[],
    encrypt?: boolean
}

export type ModDb = { [key: string]: Mod }
export type UserScriptNotify = {
    type: 'userScriptExcute',
    name: string,
    file: string,
    fileType: string,
    error: any
}
export type UserScriptClean = {
    type: 'clean'
}
export type UserScriptExcutingResult = {
    file: string,
    type: string,
    success: boolean,
    error?: any
}
export type ModExcutingResult = {
    name: string,
    results: UserScriptExcutingResult[]
}
export type ModExcutionResultDb = {
    [name: string]: ModExcutingResult
}