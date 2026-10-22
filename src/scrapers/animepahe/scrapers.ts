import axios from "axios";
import createHttpError from "http-errors";
import {
  paheBase,
  paheHeaders,
  unpackKwik,
  resolveKwikHls,
  qualityFromKwikUrl,
} from "../../utils/animepahe/constants";
import { cfGet } from "../../utils/flaresolverr";
import type {
  ScrapedPaheEpisodes,
  ScrapedPaheSearch,
  ScrapedPaheSources,
} from "../../types/animepahe";

// ── GET /api?m=search&q= ─────────────────────────────────────────────────────
export async function paheSearch(q: string): Promise<ScrapedPaheSearch> {
  const base = paheBase();
  let res;
  try {
    res = await cfGet<{ data?: Array<{ slug: string; name: string; poster?: string; type?: string }> }>(
      `${base}/api`,
      {
        params: { m: "search", q },
        headers: paheHeaders(),
        timeout: 15000,
        maxRedirects: 5,
      },
    );
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 403 || status === 503) {
      throw createHttpError(
        502,
        `animepahe is Cloudflare-challenging this host's egress (HTTP ${status}) — deploy from residential/self-hosted egress or retry later (see README hosting notes)`,
      );
    }
    throw e;
  }
  const data = res.data;
  if (!data || !Array.isArray(data.data)) {
    throw createHttpError(502, "animepahe search returned unexpected payload (Cloudflare?)");
  }
  return {
    animes: data.data.map((a: { slug: string; name: string; poster?: string; type?: string }) => ({
      id: a.slug,
      name: a.name,
      img: a.poster || null,
      type: a.type,
    })),
    hasNextPage: false,
  };
}

// ── /anime/{slug} page → internal numeric id + session ───────────────────────
async function animePageMeta(slug: string): Promise<{ id: string; session: string; anilistID: number | null; malID: number | null; name: string }> {
  const base = paheBase();
  const res = await cfGet<string>(`${base}/anime/${slug}`, {
    headers: { ...paheHeaders(), "X-Requested-With": "" },
    timeout: 20000,
    maxRedirects: 5,
  });
  const html: string = res.data;
  const idM = html.match(/getAnimeId\s*=\s*['"]?(\d+)/) || html.match(/"id"\s*:\s*(\d+),\s*"title"/);
  const sessionM = html.match(/anime_id[^>]*value="([^"]+)"/) || html.match(/\/play\/([a-f0-9-]{30,})\//);
  const syncM = html.match(/<a[^>]+href="https?:\/\/anilist\.co\/anime\/(\d+)/);
  const malM = html.match(/<a[^>]+href="https?:\/\/myanimelist\.net\/anime\/(\d+)/);
  const titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!idM || !sessionM) {
    throw createHttpError(502, "animepahe anime page blocked or layout changed");
  }
  return {
    id: idM[1],
    session: sessionM[1],
    anilistID: syncM ? Number(syncM[1]) : null,
    malID: malM ? Number(malM[1]) : null,
    name: titleM ? titleM[1].trim() : slug,
  };
}

// ── GET /api?m=release&id=&sort=episode_asc&page= ─────────────────────────────
export async function paheEpisodes(slug: string, page = 1): Promise<ScrapedPaheEpisodes> {
  const base = paheBase();
  const meta = await animePageMeta(slug);
  const res = await cfGet<{ data?: Array<Record<string, string>>; total?: number; per_page?: number; current_page?: number; last_page?: number }>(
    `${base}/api`,
    {
      params: { m: "release", id: meta.id, sort: "episode_asc", page },
      headers: paheHeaders(),
      timeout: 15000,
      maxRedirects: 5,
    },
  );
  const d = res.data;
  if (!d || !Array.isArray(d.data)) {
    throw createHttpError(502, "animepahe release API blocked or changed");
  }
  return {
    animeId: meta.id,
    animeName: meta.name,
    animeSession: meta.session,
    total: Number(d.total) || d.data.length,
    perPage: Number(d.per_page) || d.data.length,
    currentPage: Number(d.current_page) || page,
    lastPage: Number(d.last_page) || 1,
    episodes: d.data.map((e: Record<string, string>) => ({
      number: parseFloat(e.episode),
      session: e.session,
      title: e.title || `Episode ${e.episode}`,
      audio: e.audio === "eng" ? "eng" : "jpn",
      snapshot: e.snapshot || null,
      duration: e.duration || null,
    })),
  };
}

/** Fetch every release page (episode list can span pages). */
export async function paheAllEpisodes(slug: string, maxPages = 10): Promise<ScrapedPaheEpisodes> {
  const first = await paheEpisodes(slug, 1);
  const all = first.episodes;
  let lastPage = first.lastPage;
  for (let p = 2; p <= Math.min(lastPage, maxPages); p++) {
    const next = await paheEpisodes(slug, p);
    all.push(...next.episodes);
    lastPage = next.lastPage;
  }
  return { ...first, episodes: all, total: all.length, lastPage };
}

// ── /play/{animeSession}/{epSession} → kwik links → HLS ───────────────────────
export async function paheSources(
  animeSession: string,
  epSession: string,
): Promise<ScrapedPaheSources> {
  const base = paheBase();
  const playRes = await cfGet<string>(`${base}/play/${animeSession}/${epSession}`, {
    headers: { ...paheHeaders(), "X-Requested-With": "" },
    timeout: 20000,
    maxRedirects: 5,
  });
  const html: string = playRes.data;

  // page embeds a JSON blob of kwik links per quality: getLinks("...', '...');
  const kwikUrls = Array.from(
    new Set(
      (html.match(/https:\/\/kwik[^"'\\]+/g) || []).map((u) => u.replace(/\\\//g, "/")),
    ),
  );
  const sources: ScrapedPaheSources["sources"] = [];
  const referer = `${base}/`;

  for (const kwikUrl of kwikUrls.slice(0, 6)) {
    try {
      const k = await axios.get(kwikUrl, {
        headers: {
          "User-Agent": paheHeaders()["User-Agent"],
          Referer: referer,
          Accept: "*/*",
        },
        timeout: 15000,
        maxRedirects: 4,
      });
      const unpacked = unpackKwik(k.data as string);
      if (!unpacked) continue;
      const hls = resolveKwikHls(kwikUrl, unpacked);
      if (!hls) continue;
      sources.push({
        url: hls,
        isM3U8: true,
        quality: qualityFromKwikUrl(hls),
        kwikUrl,
      });
    } catch {
      /* per-kwik failure tolerated */
    }
  }

  return {
    headers: {
      Referer: referer,
      "User-Agent": paheHeaders()["User-Agent"],
    },
    sources,
    anilistID: null,
    malID: null,
    error: sources.length
      ? undefined
      : "kwik challenge could not be resolved from this host — kwik rotates its scheme and Cloudflare-blocks datacenter IPs; deploy closer to residential egress or retry",
  };
}
