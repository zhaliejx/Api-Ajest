export const KAI_BASE = process.env.ANIMEKAI_BASE || "https://animekai.to";

export const KAI_UA =
  process.env.ANIMEKAI_UA ||
  "Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0";

export function kaiHeaders(referer?: string): Record<string, string> {
  return {
    "User-Agent": KAI_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer || `${KAI_BASE}/home`,
  };
}
