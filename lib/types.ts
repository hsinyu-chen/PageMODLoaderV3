
export type InjectFileType = 'script' | 'style'

export type ModelConfig = {
    match: string,
    inject: { path: string, type: InjectFileType }[]
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
    files: ModFile[]
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