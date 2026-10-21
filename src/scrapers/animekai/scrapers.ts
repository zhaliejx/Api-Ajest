import axios from "axios";
import { load, type CheerioAPI } from "cheerio";
import { puppeteerGet } from "../../utils/kickassanime/browser";
import { KAI_BASE, kaiHeaders } from "../../utils/animekai/constants";
import type {
  KaiEpisodeServers,
  KaiSearchResult,
  KaiSeriesInfo,
} from "../../types/animekai";

/** AnimeKai sits behind aggressive bot protection; try axios first (fast),
 *  fall back to the shared Puppeteer CF-solver (same pattern as kickassanime). */
async function kaiGetHtml(url: string): Promise<string> {
  let axiosStatus: number | undefined;
  try {
    const res = await axios.get(url, { headers: kaiHeaders(url), timeout: 15000, maxRedirects: 4 });
    const html: string = res.data;
    if (html.includes("Just a moment") || html.includes("cf-challenge")) {
      throw new Error("cloudflare challenge");
    }
    return html;
  } catch (e) {
    axiosStatus = (e as { response?: { status?: number } }).response?.status;
    const viaBrowser = await puppeteerGet(url).catch(() => null);
    if (viaBrowser) return typeof viaBrowser === "string" ? viaBrowser : JSON.stringify(viaBrowser);
    throw new Error(
      axiosStatus === 403 || axiosStatus === 503
        ? `animekai is Cloudflare-challenging this host's egress (HTTP ${axiosStatus}) and no headless browser is available — deploy from residential/self-hosted egress (see README)`
        : `animekai unreachable from this host: ${url}`,
    );
  }
}

async function kaiGetJson<T>(url: string): Promise<T> {
  const html = await kaiGetHtml(url);
  return JSON.parse(html) as T;
}

// ── /search?keyword=&page= ───────────────────────────────────────────────────
export async function kaiSearch(keyword: string, page = 1): Promise<KaiSearchResult> {
  const html = await kaiGetHtml(
    `${KAI_BASE}/browse?keyword=${encodeURIComponent(keyword)}&page=${page}`,
  );
  const $: CheerioAPI = load(html);
  const animes: KaiSearchResult["animes"] = [];
  $(".tab-content .item, .film_list-wrap .item").each((_, el) => {
    const box = $(el).find(".item-poster, .poster");
    const href = box.find("a").attr("href") || $(el).find("a").first().attr("href") || "";
    const id = href.replace(/^\/(?:watch|browse)\//, "").replace(/\/$/, "");
    if (!id) return;
    const sub = parseInt($(el).find(".sub").text(), 10) || 0;
    const dub = parseInt($(el).find(".dub").text(), 10) || 0;
    animes.push({
      id,
      name: box.find(".title, h3").text().trim() || box.find("a").attr("title") || id,
      img: box.find("img").attr("data-src") || box.find("img").attr("src") || null,
      jname: $(el).find(".jname").text().trim() || undefined,
      duration: $(el).find(".duration").text().trim() || null,
      type: $(el).find(".type").text().trim() || null,
      sub,
      dub,
      episodes: Math.max(sub, dub),
    });
  });
  const totalPages = parseInt($("ul.pagination li:last-child").text(), 10) || page;
  return { animes, hasNextPage: page < totalPages, currentPage: page, totalPages };
}

// ── /watch/{slug} → info + episodes (ajax list needs the `id` prop) ──────────
export async function kaiSeries(slug: string): Promise<KaiSeriesInfo> {
  const html = await kaiGetHtml(`${KAI_BASE}/watch/${slug}`);
  const $: CheerioAPI = load(html);
  const animeId = $("[data-id]").first().attr("data-id") || "";

  const genres: string[] = [];
  $(".meta span:contains('Genres') ~ *, .genres a, .sc-detail:contains('Genres') a").each(
    (_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    },
  );

  const info: KaiSeriesInfo["info"] = {
    id: slug,
    name: $(".title, h1").first().text().trim() || slug,
    jname: $(".jname, .alias").first().text().trim() || undefined,
    img: $(".poster img, .cover img").attr("data-src") || $(".poster img").attr("src") || null,
    description: $(".description, .shorting").first().text().trim(),
    type: $(".meta .type, .sc-detail:contains('Type')").text().trim() || null,
    status: $(".sc-detail:contains('Status')").text().replace("Status:", "").trim() || null,
    airedDate:
      $(".sc-detail:contains('Premiered'), .sc-detail:contains('Aired')").text().trim() || null,
    genres: Array.from(new Set(genres)).slice(0, 12),
    studios: [],
  };

  // episodes ajax — animekai guards this with a dynamic `_` token; when the
  // token scheme is absent the raw call still serves pages for many titles.
  const episodes: KaiSeriesInfo["episodes"] = [];
  try {
    const data = await kaiGetJson<{ status?: boolean; html?: string; result?: string }>(
      `${KAI_BASE}/ajax/episodes/list?id=${encodeURIComponent(animeId)}&page=1`,
    );
    const listHtml = data.html || data.result || "";
    const $$: CheerioAPI = load(listHtml);
    $$("a.ssl, .episode-item a, a[page]").each((_, el) => {
      const num = parseInt($$(el).attr("num") || $$(el).text(), 10);
      const href = $$(el).attr("href") || "";
      const session = href.split("?")[0].split("/").pop() || "";
      if (!Number.isFinite(num) || !session) return;
      episodes.push({
        number: num,
        session,
        title: $$(el).attr("title") || null,
        isFiller: ($$(el).attr("class") || "").includes("filler"),
      });
    });
  } catch {
    /* episode ajax may require the dynamic token — surfaced via empty list */
  }

  return {
    info,
    seasons: [],
    episodes,
    error: episodes.length
      ? undefined
      : "episode list needs animekai's dynamic token scheme — site reachable but ajax guarded",
  };
}

// ── ajax/episode/servers?id={episode} → server ids ───────────────────────────
export async function kaiServers(episodeSession: string): Promise<KaiEpisodeServers> {
  const data = await kaiGetJson<{ html?: string; result?: string }>(
    `${KAI_BASE}/ajax/episode/servers?id=${encodeURIComponent(episodeSession)}`,
  );
  const html = data.html || data.result || "";
  const $: CheerioAPI = load(html);
  const sub: KaiEpisodeServers["sub"] = [];
  const dub: KaiEpisodeServers["dub"] = [];
  $("li").each((_, el) => {
    const entry = {
      serverName: $(el).attr("data-type") || $(el).text().trim() || "server",
      serverId: $(el).attr("data-id") || "",
    };
    if (!entry.serverId) return;
    if (($(el).attr("data-audio") || $(el).closest("[data-audio]").attr("data-audio")) === "dub") {
      dub.push(entry);
    } else {
      sub.push(entry);
    }
  });
  return {
    episodeId: episodeSession,
    sub,
    dub,
    error: sub.length || dub.length ? undefined : "animekai server list empty (token-guarded ajax)",
  };
}

// ── ajax/episode/sources?id={server} → embed iframe URLs (best-effort) ───────
export async function kaiSources(serverId: string): Promise<{
  iframeUrls: string[];
  note: string;
}> {
  const data = await kaiGetJson<{ html?: string; result?: string }>(
    `${KAI_BASE}/ajax/episode/sources?id=${encodeURIComponent(serverId)}`,
  );
  const html = data.html || data.result || "";
  const iframeUrls = Array.from(
    new Set(
      (html.match(/https?:\/\/[^"'\s]+(?:embed|titan|player)[^"'\s]*/g) || []).map((u) =>
        u.replace(/\\\//g, "/"),
      ),
    ),
  );
  return {
    iframeUrls,
    note: iframeUrls.length
      ? "embed iframes only — animekai's titan player carries encrypted sources; stream URLs require its live encoder key (out of scope for this build)"
      : "no embed URLs resolved (token-guarded ajax or changed layout)",
  };
}
