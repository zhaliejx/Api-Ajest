import axios, { type AxiosRequestConfig } from "axios";

export const MANGADEX_API = process.env.MANGADEX_API || "https://api.mangadex.org";
export const MANGADEX_COVERS =
  process.env.MANGADEX_COVERS || "https://uploads.mangadex.org/covers";

export const MD_LANGS = (process.env.MANGADEX_LANGS || "en,en-us").split(",");

/** MangaDex politely rate-limits; keep a small default UA and JSON accept. */
export function mdAxios(): typeof axios {
  const inst = axios.create({
    baseURL: MANGADEX_API,
    timeout: 15000,
    headers: {
      Accept: "application/json",
      "User-Agent": "AnimeApiFork/1.1 (manga provider; +https://github.com/)",
    },
  });
  return inst as unknown as typeof axios;
}

export async function mdGet<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const inst = axios.create({
    baseURL: MANGADEX_API,
    timeout: 15000,
    headers: {
      Accept: "application/json",
      "User-Agent": "AnimeApiFork/1.1 (manga provider; +https://github.com/)",
    },
  });
  const res = await inst.get<T>(path, config);
  return res.data;
}

export function coverUrl(mangaId: string, fileName?: string | null): string | null {
  if (!fileName) return null;
  return `${MANGADEX_COVERS}/${mangaId}/${fileName}`;
}

export function pickLocalized(map: Record<string, string> | undefined): string | null {
  if (!map) return null;
  for (const lang of MD_LANGS) {
    if (map[lang]) return map[lang];
  }
  const first = Object.values(map)[0];
  return first ?? null;
}
