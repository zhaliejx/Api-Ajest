import axios from "axios";

export const CR_BASE = process.env.CRUNCHYROLL_BASE || "https://www.crunchyroll.com";

export const CR_UA =
  process.env.CR_UA ||
  "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0";

/** Public client id — Crunchyroll's own web player ships it publicly.
 *  Override with CR_CLIENT_ID env when they rotate it. */
export function crClientId(): string {
  return (process.env.CR_CLIENT_ID || "").trim();
}

/** Best-effort scrape of the client id from crunchyroll.com's own bundle. */
export async function scrapeClientId(): Promise<string | null> {
  try {
    const res = await axios.get(`${CR_BASE}/`, {
      headers: {
        "User-Agent": CR_UA,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 4,
    });
    const html: string = res.data;
    const m =
      html.match(/clientID["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i) ||
      html.match(/"clientId"\s*:\s*"([0-9a-f-]{36})"/i) ||
      html.match(/client_id["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
