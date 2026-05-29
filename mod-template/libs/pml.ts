// Page MOD Loader — mod-facing option API.
//
// Bundled INTO each mod (via @libs/pml) and runs in the page's MAIN world. All state below
// lives in this bundle's module closure — never on `window` — so the host page can neither
// read nor tamper with it. __PML_EID__ / __PML_NAME__ are injected by the loader into the
// surrounding IIFE scope (see service_worker buildScripts). 'pmlPoll'/'pmlChoices' are the
// wire protocol agreed with the loader, hardcoded because the bundle has no access to @lib.

declare const __PML_EID__: string
declare const __PML_NAME__: string

export type PmlValue = boolean | string | string[] | number
export type PmlValues = Record<string, PmlValue>
export type PmlChoice = { value: string, label: string }

const _send: (id: string, msg: any) => Promise<any> =
    (globalThis as any).chrome.runtime.sendMessage.bind((globalThis as any).chrome.runtime)

let _values: PmlValues | null = null
let _rev: number | null = null   // value revision (durable, from modOptionsRev)
let _btn = 0                     // this tab's total button presses (volatile, resets on SW restart)
let _looping = false
let _optSnapshot: string | null = null
const _subs: Array<(values: PmlValues) => void> = []
const _buttons = new Map<string, { last: number, cb: () => void }>()

function _poll(rev: number | null): Promise<{ rev: number, btn: number, values: PmlValues }> {
    return _send(__PML_EID__, { type: 'pmlPoll', name: __PML_NAME__, rev, btn: _btn })
}
function _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** Read the current option values once. Button keys appear as press counters. */
export async function getOptions(): Promise<PmlValues> {
    if (_values) return _values
    const r = await _poll(null)
    _values = r.values; _rev = r.rev; _btn = r.btn
    return _values
}

/** Subscribe to value-option changes. Fires on change, not on the initial value. */
export function onOptionChange(cb: (values: PmlValues) => void): void {
    _subs.push(cb)
    _ensureLoop()
}

/** Subscribe to a declared button. The current press count is taken as the baseline; only
 *  later increments fire the callback. */
export function onButton(key: string, cb: () => void): void {
    const last = typeof _values?.[key] === 'number' ? _values[key] as number : NaN
    _buttons.set(key, { last, cb })
    _ensureLoop()
}

/** Provide dynamic dropdown/checklist choices for this tab's popup. */
export function setChoices(key: string, choices: PmlChoice[]): void {
    void _send(__PML_EID__, { type: 'pmlChoices', name: __PML_NAME__, key, choices })
}

function _ensureLoop(): void {
    if (_looping) return
    _looping = true
    void _loop()
}

async function _loop(): Promise<void> {
    let seeded = false
    while (_subs.length || _buttons.size) {
        try {
            // First poll forces rev=null for an immediate snapshot to seed baselines.
            const r = await _poll(seeded ? _rev : null)
            seeded = true
            _rev = r.rev; _btn = r.btn; _values = r.values
            _dispatch(r.values)
        } catch {
            await _sleep(1000) // SW recycled / port closed — back off, re-poll (also wakes the SW)
        }
    }
    _looping = false
}

function _dispatch(values: PmlValues): void {
    for (const [key, state] of _buttons) {
        const counter = typeof values[key] === 'number' ? values[key] as number : 0
        if (Number.isNaN(state.last) || counter < state.last) {
            state.last = counter // first sight or SW-restart reset — rebaseline, don't fire
        } else if (counter > state.last) {
            const times = counter - state.last // N presses across the poll gap → fire N times
            state.last = counter
            for (let i = 0; i < times; i++) state.cb()
        }
    }
    const snapshot = _optSnap(values)
    if (_optSnapshot === null) {
        _optSnapshot = snapshot // seed, don't fire
    } else if (snapshot !== _optSnapshot) {
        _optSnapshot = snapshot
        for (const cb of _subs) cb(values)
    }
}

function _optSnap(values: PmlValues): string {
    // exclude buttons (the only numeric values) so a press never looks like a value change —
    // covers buttons declared but never passed to onButton(), which _buttons wouldn't track
    const keys = Object.keys(values).filter(key => typeof values[key] !== 'number').sort()
    return JSON.stringify(keys.map(key => [key, values[key]]))
}
