// Shared AES-256-GCM helper for the mod↔SW UI channel. Imported directly by the service worker
// (rollup + node-resolve bundles noble) AND compiled into the injected mod closure via a dedicated
// IIFE bundle (rollup.crypto.config.js) — same source both ends guarantees an identical wire format.
//
// Wire format is hex, not base64: noble ships hex helpers (fully typed, no DOM lib needed) but no
// base64, and runtime.sendMessage serializes as JSON so a raw Uint8Array would bloat/corrupt.

import { gcm } from '@noble/ciphers/aes.js'
import { utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes, randomBytes, concatBytes } from '@noble/ciphers/utils.js'

const IV_LEN = 12

/** Seal an object: hex( iv(12) ‖ AES-256-GCM(key, utf8(JSON(obj))) ). */
export function pmlSeal(key: Uint8Array, obj: unknown): string {
    const iv = randomBytes(IV_LEN)
    const ct = gcm(key, iv).encrypt(utf8ToBytes(JSON.stringify(obj)))
    return bytesToHex(concatBytes(iv, ct))
}

/** Reverse of pmlSeal. Throws if the tag fails (tampered/garbage) — callers drop the message. */
export function pmlOpen(key: Uint8Array, hex: string): unknown {
    const buf = hexToBytes(hex)
    return JSON.parse(bytesToUtf8(gcm(key, buf.subarray(0, IV_LEN)).decrypt(buf.subarray(IV_LEN))))
}

/** Fresh 256-bit key for a mod. */
export function randomKey32(): Uint8Array {
    return randomBytes(32)
}

export { bytesToHex, hexToBytes }
