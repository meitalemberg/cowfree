/* SHA-256 בלי תלות ב-crypto.subtle, שלא זמין בדף http ברשת מקומית.
   הקודים של העמדות לא נמצאים בקוד: נשמר רק הגיבוב שלהם. */
(function (root) {
  'use strict';
  let K = null;
  function frac(x) { return ((x % 1) * 4294967296) >>> 0; }
  function primes(n) {
    const out = [];
    for (let c = 2; out.length < n; c++) {
      let p = true;
      for (let i = 2; i * i <= c; i++) if (c % i === 0) { p = false; break; }
      if (p) out.push(c);
    }
    return out;
  }
  function sha256(str) {
    if (!K) K = primes(64).map(p => frac(Math.cbrt(p)));
    let H = primes(8).map(p => frac(Math.sqrt(p)));
    const bytes = new TextEncoder().encode(str);
    const l = bytes.length;
    const n = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(n);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 4, l * 8);
    const w = new Uint32Array(64);
    const rr = (x, s) => (x >>> s) | (x << (32 - s));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H = [a, b, c, d, e, f, g, h].map((v, i) => (v + H[i]) >>> 0);
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
  }
  root.sha256 = sha256;
})(typeof window !== 'undefined' ? window : globalThis);
