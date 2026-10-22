import { isSiteReachable } from "../../lib/isSiteReachable";
import { websites_collection, AnimeWebsiteConfig } from "../../config/websites";

type AniWatchConfig = {
  BASE: string;
  HOME: string;
  SEARCH: string;
  GENRE: string;
  AJAX: string;
};

const aniwatch: AnimeWebsiteConfig = websites_collection["AniWatch"];
// storing initial base link
let aniwatch_base = aniwatch.BASE;
// array of clones
let clones_array: string[] = [];
clones_array.push(aniwatch_base);

if (aniwatch.CLONES) {
  const aniwatch_clones: Record<string, string[]> = aniwatch.CLONES;

  for (const key in aniwatch_clones) {
    if (Object.prototype.hasOwnProperty.call(aniwatch_clones, key)) {
      const values: string[] = aniwatch_clones[key];
      clones_array.push(...values);
    }
  }
}

// Testing
// console.log(clones_array);

// make new aniwatchobj using new aniwatch_base
const makeAniWatchObj = (aniwatch_base: string): AniWatchConfig => {
  // Testing
  // console.log(aniwatch_base);
  return {
    BASE: aniwatch_base,
    HOME: `${aniwatch_base}/home`,
    SEARCH: `${aniwatch_base}/search`,
    GENRE: `${aniwatch_base}/genre`,
    AJAX: `${aniwatch_base}/ajax`,
  };
};

export const DEFAULT_HIANIME_URL = "https://hianime.to";

// Resolve the reachable base once per TTL — the reachability probe costs a
// 6s timeout per clone on hosts that tarpit plain connections, so re-probing
// on EVERY scraper call is far too expensive.
let urlCache: { obj: AniWatchConfig; at: number } | null = null;
const URL_CACHE_TTL_MS = 10 * 60_000;

// return fn
const URL_fn = async (): Promise<AniWatchConfig> => {
  try {
    if (urlCache && Date.now() - urlCache.at < URL_CACHE_TTL_MS) {
      return urlCache.obj;
    }
    for (const url of clones_array) {
      if (await isSiteReachable(url as string)) {
        aniwatch_base = url;
        break;
      }
    }
    const obj = makeAniWatchObj(aniwatch_base as string);
    urlCache = { obj, at: Date.now() };
    return obj;
  } catch (error) {
    console.error("Error occurred in both sites:", error);
    throw error; // Rethrow the error to handle it outside
  }
};

export { URL_fn };
