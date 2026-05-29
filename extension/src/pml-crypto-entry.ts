// Entry for the injectable crypto bootstrap. rollup.crypto.config.js compiles this to an IIFE
// (`var __pmlCrypto = (function(){...})()`) that pml-channel.ts bakes into each encrypt:true mod's
// closure — same source as the SW's own import, so the wire format is identical both ends.
export { pmlSeal, pmlOpen } from './pml-crypto'
