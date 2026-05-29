
export type InjectFileType = 'script' | 'style'

export type ModOptionType = 'toggle' | 'text' | 'dropdown' | 'checklist' | 'button'
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

export const STORAGE_MOD_OPTIONS = 'modOptions'
export const STORAGE_MOD_OPTIONS_REV = 'modOptionsRev'
export const MSG_PML_POLL = 'pmlPoll'
export const MSG_PML_CHOICES = 'pmlChoices'
export const MSG_PML_GET_CHOICES = 'pmlGetChoices'
export const MSG_PML_BUTTON = 'pmlButton'

export function resolveOptionValue(option: ModOption, stored: ModOptionValue | undefined): ModOptionValue {
    if (option.type === 'button') return typeof stored === 'number' ? stored : 0
    if (stored !== undefined) return stored
    if (option.default !== undefined) return option.default
    return option.type === 'toggle' ? false : option.type === 'checklist' ? [] : ''
}

export type ModelConfig = {
    match: string,
    inject: { path: string, type: InjectFileType }[],
    options?: ModOption[]
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
    options?: ModOption[]
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