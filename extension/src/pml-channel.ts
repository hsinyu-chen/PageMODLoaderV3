// The encrypted-channel subsystem, kept out of service_worker.ts. Owns per-mod key lifecycle and
// the seal/open envelope so the SW only deals in `newChannel(option)` + plaintext payloads.
//
// A mod opts in with config.json `"encrypt": true`. When on, its whole option/UI channel is sealed
// with AES-256-GCM (per-mod key, baked into the mod's closure alongside the impl — never on window).
// When off, the channel is plaintext exactly as before. The SW resolves the per-mod key and lets the
// channel decide: a keyed mod is served ONLY the sealed envelope, an unkeyed mod ONLY plaintext —
// so a page script can't downgrade an encrypted mod by sending a plaintext poll.

import { ModDb, Mod, STORAGE_MOD_KEYS, MSG_PML, ownValue } from '@lib/types'
import { pmlSeal, pmlOpen, randomKey32, bytesToHex, hexToBytes } from './pml-crypto'
import { PML_CRYPTO_BOOTSTRAP } from './generated/pml-crypto-bootstrap'

// name indexes our key store; reject prototype-polluting values defensively.
function isSafeName(s: string): boolean {
    return s !== '__proto__' && s !== 'constructor' && s !== 'prototype'
}

// name → key bytes. Repopulated by ensureModKeys; keyFor falls back to storage on a cold miss.
const keyCache: Record<string, Uint8Array> = Object.create(null)

/** Ensure every enabled encrypt:true mod has a persisted 256-bit key, then refresh the cache.
 *  Keys are generated once and reused across SW restarts so already-injected pages stay decryptable. */
export async function ensureModKeys(mods: ModDb): Promise<void> {
    const stored = ((await chrome.storage.local.get(STORAGE_MOD_KEYS))[STORAGE_MOD_KEYS] ?? {}) as Record<string, string>
    let dirty = false
    // Generate for any enabled encrypt mod that lacks a key. ownValue: a mod named like an
    // Object.prototype member (toString, …) must not read the inherited property as its "key".
    for (const mod of Object.values(mods)) {
        if (!mod.enabled || !mod.encrypt || !isSafeName(mod.name)) continue
        if (typeof ownValue(stored, mod.name) !== 'string') { stored[mod.name] = bytesToHex(randomKey32()); dirty = true }
    }
    // Prune keys for mods that are gone or no longer encrypt:true. A lingering key would make the SW
    // treat the now-plaintext mod as encrypted and reject its polls (a self-inflicted downgrade block).
    for (const name of Object.keys(stored)) {
        if (!ownValue(mods, name)?.encrypt) { delete stored[name]; dirty = true }
    }
    if (dirty) await chrome.storage.local.set({ [STORAGE_MOD_KEYS]: stored })
    invalidateKeyCache()
    for (const [name, hex] of Object.entries(stored)) {
        if (isSafeName(name) && typeof hex === 'string') keyCache[name] = hexToBytes(hex)
    }
}

/** Key for a mod, or undefined if it's not an encrypt mod. Cache-first with a storage fallback for
 *  the window after an SW restart before ensureModKeys has run. */
export async function keyFor(name: string): Promise<Uint8Array | undefined> {
    if (!isSafeName(name)) return undefined
    if (keyCache[name]) return keyCache[name]
    const stored = ((await chrome.storage.local.get(STORAGE_MOD_KEYS))[STORAGE_MOD_KEYS] ?? {}) as Record<string, string>
    const hex = ownValue(stored, name)
    if (typeof hex !== 'string') return undefined
    return (keyCache[name] = hexToBytes(hex))
}

/** Drop the cache when modKeys changes underneath us (another context wrote it). */
export function invalidateKeyCache(): void {
    for (const k in keyCache) delete keyCache[k]
}

/** Closure-prefix text for an encrypt:true mod's IIFE: the crypto impl + its key, both living only
 *  in the closure (page scripts can't read the key or swap the impl). Empty for a plaintext mod. */
export function cryptoBootstrap(mod: Mod): string {
    if (!mod.encrypt) return ''
    const key = keyCache[mod.name] // ensureModKeys runs before buildScripts, so this is populated
    if (!key) return ''
    return `${PML_CRYPTO_BOOTSTRAP};const __PML_KEY__=new Uint8Array([${key.join(',')}]);`
}

export type PmlChannel = {
    /** Inner payload of an incoming message, or null to drop it (wrong mode / tampered / garbage). */
    open(request: any): any
    /** Wrap an outgoing response payload for this channel (sealed when encrypted, raw otherwise). */
    seal(payload: unknown): any
}

/** A per-message channel. `option.key` present ⇒ encrypted (envelope only); absent ⇒ plaintext. */
export function pmlChannel(option: { key?: Uint8Array }): PmlChannel {
    const key = option.key
    if (key) {
        return {
            open(request) {
                if (request?.type !== MSG_PML || typeof request.enc !== 'string') return null
                try { return pmlOpen(key, request.enc) } catch { return null }
            },
            seal(payload) { return { enc: pmlSeal(key, payload) } },
        }
    }
    return {
        open(request) { return request?.type === MSG_PML ? null : request },
        seal(payload) { return payload },
    }
}
