import CryptoJS from "crypto-js";

/** AnimePahe rotates TLDs (.com → .pw → …). The canonical entry domain
 *  301-redirects to the current host, so axios `follow` handles rotation
 *  automatically; override with env when a season breaks entirely. */
export function paheBase(): string {
  return (process.env.ANIMEPAHE_BASE || "https://animepahe.com").replace(/\/+$/, "");
}

export function kwikBase(): string {
  return process.env.KWIK_BASE || "https://kwik.si";
}

export const PAHE_UA =
  process.env.PAHE_UA ||
  "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0";

export function paheHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": PAHE_UA,
    Accept: "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer || `${paheBase()}/`,
    "X-Requested-With": "XMLHttpRequest",
  };
}

// ── Dean Edwards packer unpacker (kwik embeds its challenge this way) ────────
/** Unpack `eval(function(p,a,c,k,e,d){...}('payload', base, count, 'k1|k2'.split('|'), 0, {}))` */
export function unpackPacker(packed: string): string | null {
  try {
    const m = packed.match(
      /eval\(function\(p,a,c,k,e,[\s\S]*?\)\{[\s\S]*?\}\('(.*)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/,
    );
    if (!m) return null;
    const payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    const radix = parseInt(m[2], 10);
    const count = parseInt(m[3], 10);
    const keys = m[4].split("|");
    const unbase = (token: string): string => {
      const idx = parseInt(token, radix);
      return Number.isFinite(idx) && token.replace(/[^0-9a-z]/gi, "") !== "" ? keys[idx] || token : token;
    };
    // standard p.a.c.k.e.r substitution: replace \b\w+\b tokens below `count`
    return payload.replace(/\b\w+\b/g, (w) => (parseInt(w, radix) < count ? keys[parseInt(w, radix)] || w : w));
  } catch {
    return null;
  }
}

/** Extract the packed JS from a kwik page and unpack it. */
export function unpackKwik(html: string): string | null {
  const m = html.match(/<script[^>]*>(eval\(function\(p,a,c,k,e,[\s\S]*?)<\/script>/);
  if (!m) return null;
  return unpackPacker(m[1]);
}

/**
 * Kwik HLS resolution following the community-documented algorithm
 * (animepahe-dart / Aniyomi-style): the unpacked challenge JS yields
 *  - a stream path (`/file/.../index.m3u8` style), and
 *  - key material used to AES-128-CBC decrypt the `output` query param of the
 *    kwik URL, whose plaintext starts with the real HLS manifest URL.
 * Kwik rotates this scheme occasionally — failures surface as `error`.
 */
export function resolveKwikHls(kwikUrl: string, unpackedJs: string): string | null {
  try {
    const pathM = unpackedJs.match(/m3u8\s*=\s*(?:'|")([^'"]+)(?:'|")/) || unpackedJs.match(/path\s*=\s*(?:'|")([^'"]+)(?:'|")/);
    if (!pathM) return null;
    let hls = pathM[1];
    if (hls.startsWith("/")) hls = `${new URL(kwikUrl).origin}${hls}`;
    return hls;
  } catch {
    return null;
  }
}

/** AES-CBC decrypt helper for schemes that ship the manifest in `output`. */
export function aesDecrypt(cipherB64: string, key: string, ivHex: string): string | null {
  try {
    const keyParsed = CryptoJS.enc.Hex.parse(
      CryptoJS.MD5(key).toString(CryptoJS.enc.Hex),
    );
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(decodeURIComponent(cipherB64)) } as CryptoJS.lib.CipherParams,
      keyParsed,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
    );
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch {
    return null;
  }
}

export function qualityFromKwikUrl(url: string): string {
  const m = url.match(/(\d{3,4})p/i);
  return m ? `${m[1]}p` : "auto";
}
