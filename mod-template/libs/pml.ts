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
let _seeded = false              // loop has fetched its first snapshot; _values/baselines are valid
let _needRepush = false          // a poll failed (likely SW restart) → re-push our dynamic state
let _optSnapshot: string | null = null
const _subs: Array<(values: PmlValues) => void> = []
const _immediate: Array<(values: PmlValues) => void> = [] // awaiting their first (immediate) emit
const _buttons = new Map<string, { last: number, cbs: Array<() => void> }>()
// Last choices/labels we pushed, so we can re-push them if the SW restarts and loses its memory.
const _choices = new Map<string, PmlChoice[]>()
const _labels = new Map<string, string>()

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

/** Subscribe to value-option changes. By default the callback also fires once with the
 *  current values (so the same handler applies settings on load and on change); pass
 *  { immediate: false } to fire only on subsequent changes. */
export function onOptionChange(cb: (values: PmlValues) => void, opts?: { immediate?: boolean }): void {
    _subs.push(cb)
    if (opts?.immediate !== false) {
        if (_seeded && _values) cb(_values)   // late subscription: emit current values now
        else _immediate.push(cb)              // early: emit once the loop seeds fresh values
    }
    _ensureLoop()
}

/** Subscribe to a declared button. The current press count is taken as the baseline; only
 *  later increments fire the callback. */
export function onButton(key: string, cb: () => void): void {
    const entry = _buttons.get(key)
    if (entry) {
        entry.cbs.push(cb) // share this key's press baseline; new handler fires only on future presses
    } else {
        const last = typeof _values?.[key] === 'number' ? _values[key] as number : NaN
        _buttons.set(key, { last, cbs: [cb] })
    }
    _ensureLoop()
}

/** Provide dynamic dropdown/checklist choices for this tab's popup. */
export function setChoices(key: string, choices: PmlChoice[]): void {
    _choices.set(key, choices)
    void _send(__PML_EID__, { type: 'pmlChoices', name: __PML_NAME__, key, choices }).catch(() => { })
    _ensureLoop() // hold a poll so the SW stays warm and we can re-push if it restarts
}

/** Set the text of a read-only `label` control. Updates this tab's popup live if open. */
export function setLabel(key: string, text: string): void {
    _labels.set(key, text)
    void _send(__PML_EID__, { type: 'pmlLabel', name: __PML_NAME__, key, text }).catch(() => { })
    _ensureLoop()
}

function _repushDynamic(): void {
    for (const [key, choices] of _choices) void _send(__PML_EID__, { type: 'pmlChoices', name: __PML_NAME__, key, choices }).catch(() => { })
    for (const [key, text] of _labels) void _send(__PML_EID__, { type: 'pmlLabel', name: __PML_NAME__, key, text }).catch(() => { })
}

function _ensureLoop(): void {
    if (_looping) return
    _looping = true
    void _loop()
}

// Isolate mod-author callbacks: one throwing handler must not abort the others or the poll loop.
function _safe(run: () => void): void {
    try { run() } catch (e) { console.error('[pml] option handler threw', e) }
}

async function _loop(): Promise<void> {
    while (_subs.length || _buttons.size || _choices.size || _labels.size) {
        try {
            // Until seeded, force rev=null for an immediate snapshot to seed baselines.
            const r = await _poll(_seeded ? _rev : null)
            _rev = r.rev; _btn = r.btn; _values = r.values
            _dispatch(r.values) // on the seed pass this only sets baselines (fires nothing)
            if (!_seeded) {
                _seeded = true
                for (const cb of _immediate.splice(0)) _safe(() => cb(r.values))
            }
            if (_needRepush) { _needRepush = false; _repushDynamic() } // SW came back — restore its state
        } catch (e: any) {
            // extension reload/update permanently invalidates this page's context — stop, don't busy-loop
            if ((e?.message ?? String(e)).includes('context invalidated')) { _looping = false; return }
            _needRepush = true // SW recycled / port closed — back off, re-poll (also wakes the SW)
            await _sleep(1000)
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
            for (let i = 0; i < times; i++) for (const cb of state.cbs) _safe(cb)
        }
    }
    const snapshot = _optSnap(values)
    if (_optSnapshot === null) {
        _optSnapshot = snapshot // seed, don't fire
    } else if (snapshot !== _optSnapshot) {
        _optSnapshot = snapshot
        for (const cb of _subs) _safe(() => cb(values))
    }
}

function _optSnap(values: PmlValues): string {
    // exclude buttons (the only numeric values) so a press never looks like a value change —
    // covers buttons declared but never passed to onButton(), which _buttons wouldn't track
    const keys = Object.keys(values).filter(key => typeof values[key] !== 'number').sort()
    return JSON.stringify(keys.map(key => [key, values[key]]))
}
