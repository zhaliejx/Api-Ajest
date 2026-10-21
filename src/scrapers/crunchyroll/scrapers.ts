import axios from "axios";
import createHttpError from "http-errors";
import {
  crClientId,
  CR_BASE,
  CR_UA,
  scrapeClientId,
} from "../../utils/crunchyroll/constants";
import type {
  CrEpisode,
  CrEpisodeSources,
  CrItem,
  CrListResponse,
  CrSearchResponse,
  CrSearchResult,
  CrSeriesInfo,
  CrStreamsResponse,
  CrStreamsVersion,
  CrTokenResponse,
} from "../../types/crunchyroll";

export const CR_UA_LOCAL = CR_UA;

// ── Token (anonymous client grant; CF-blocked hosts fail here honestly) ──────
let tokenCache: { token: string; exp: number } | null = null;

export async function crToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;

  let clientId = crClientId();
  if (!clientId) clientId = (await scrapeClientId()) || "";
  if (!clientId) {
    throw createHttpError(
      403,
      "Crunchyroll blocked this host's requests (Cloudflare) and no CR_CLIENT_ID env is set — set the env or deploy from an egress Crunchyroll does not challenge",
    );
  }

  const res = await axios
    .post<CrTokenResponse>(
      `${CR_BASE}/auth/v1/token`,
      new URLSearchParams({ grant_type: "client_id", client_id: clientId }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": CR_UA,
          Accept: "application/json",
        },
        timeout: 15000,
      },
    )
    .catch((e) => {
      const status = (e as { response?: { status?: number } }).response?.status;
      throw createHttpError(
        502,
        status === 403 || status === 503
          ? `crunchyroll is Cloudflare-challenging this host's egress (HTTP ${status}) — deploy from residential/self-hosted egress, or set CR_CLIENT_ID and retry (see README)`
          : `crunchyroll token request failed (HTTP ${status ?? "unknown"})`,
      );
    });
  tokenCache = {
    token: res.data.access_token,
    exp: Date.now() + Math.max(120, (res.data.expires_in || 900) - 60) * 1000,
  };
  return tokenCache.token;
}

async function crGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = await crToken();
  const res = await axios.get<T>(`${CR_BASE}${path}`, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": CR_UA,
      Accept: "application/json",
    },
    timeout: 15000,
  });
  return res.data;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function thumbOf(item: CrItem): string | null {
  const imgs =
    item.images?.[0]?.thumbnail ||
    item.episode_metadata?.images?.[0]?.thumbnail ||
    [];
  if (!imgs.length) return null;
  // pick a mid-size thumbnail
  const sorted = [...imgs].sort(
    (a, b) => (a.width ?? 0) - (b.width ?? 0),
  );
  const pick = sorted.find((i) => (i.width ?? 0) >= 400) || sorted[sorted.length - 1];
  if (!pick) return null;
  return Array.isArray(pick.url) ? pick.url[0] : pick.url || null;
}

// ── GET /content/v2/discover/search ──────────────────────────────────────────
export async function crSearch(q: string, n = 20): Promise<CrSearchResult> {
  const d = await crGet<CrSearchResponse>("/content/v2/discover/search", {
    q,
    n,
    type: "series",
    ratings: "mature",
  });
  const groups = d.data || [];
  const items =
    groups.find((g) => g.type === "series")?.items ||
    groups.flatMap((g) => g.items || []);
  return {
    animes: items.map((s) => ({
      id: s.id,
      name: s.title || s.slug_title || s.id,
      slug: s.slug_title || s.id,
      img: thumbOf(s),
      description: (s.description || "").slice(0, 500),
      isDubbed: Boolean((s.series_metadata as { is_dubbed?: boolean } | undefined)?.is_dubbed),
      isSubbed: Boolean((s.series_metadata as { is_subbed?: boolean } | undefined)?.is_subbed),
      audioLocales: ((s.series_metadata as { audio_locales?: string[] } | undefined)?.audio_locales || []) as string[],
    })),
  };
}

// ── series info + seasons + episodes ─────────────────────────────────────────
export async function crSeries(seriesId: string): Promise<CrSeriesInfo> {
  const [about, seasonsRes] = await Promise.all([
    crGet<{ data: CrItem[] }>("/content/v2/cms/objects", { object_ids: seriesId, ratings: "mature" }),
    crGet<CrListResponse>(`/content/v2/cms/series/${seriesId}/seasons`, { ratings: "mature" }),
  ]);

  const s = about.data?.[0];
  if (!s) throw createHttpError(404, "crunchyroll series not found");
  const meta = (s.series_metadata || {}) as {
    is_dubbed?: boolean;
    is_subbed?: boolean;
    audio_locales?: string[];
    maturity_ratings?: string[];
  };

  const seasons = (seasonsRes.data || []).map((se) => ({
    id: se.id,
    title: se.title || (se.season_metadata as { season_title?: string } | undefined)?.season_title || se.id,
    number: Number(
      (se.season_metadata as { season_number?: number } | undefined)?.season_number ?? NaN,
    ) || null,
    episodesCountHint: undefined as number | undefined,
  }));

  const episodes: CrEpisode[] = [];
  for (const season of seasons) {
    try {
      const eps = await crGet<CrListResponse>(`/content/v2/cms/seasons/${season.id}/episodes`, {
        ratings: "mature",
      });
      for (const e of eps.data || []) {
        const em = e.episode_metadata || {};
        episodes.push({
          id: e.id,
          number: em.display_episode_number || em.episode_number || em.episode || "",
          title: e.title || em.title || `Episode ${em.episode_number || ""}`.trim(),
          seasonId: season.id,
          seasonTitle: em.season_title || season.title,
          thumb: thumbOf(e),
          durationMs: em.duration_ms ?? null,
          isDubbed: Boolean(em.is_dubbed),
          isSubbed: Boolean(em.is_subbed),
          audioLocales: (em.audio_locales || []) as string[],
          subtitleLocales: (em.subtitle_locales || []) as string[],
          slug: e.slug_title || e.id,
        });
      }
    } catch {
      /* per-season failure tolerated */
    }
  }
  episodes.sort(
    (a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0),
  );

  return {
    info: {
      id: s.id,
      name: s.title || s.slug_title || s.id,
      slug: s.slug_title || s.id,
      description: (s.description || "").slice(0, 1200),
      img: thumbOf(s),
      isDubbed: Boolean(meta.is_dubbed),
      isSubbed: Boolean(meta.is_subbed),
      audioLocales: (meta.audio_locales || []) as string[],
      maturityRatings: (meta.maturity_ratings || []) as string[],
    },
    seasons,
    episodes,
  };
}

// ── streams (free/anonymous tier attempt; DRM content is reported, not bypassed) ──
export async function crEpisodeSources(
  episodeId: string,
  audio?: string,
): Promise<CrEpisodeSources> {
  let d: CrStreamsResponse;
  try {
    d = await crGet<CrStreamsResponse>("/content/v2/cms/objects", {
      object_ids: episodeId,
    });
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    return {
      headers: { "User-Agent": CR_UA },
      sources: [],
      drmOnly: false,
      error:
        status === 403 || status === 401
          ? "crunchyroll streams require an authenticated/premium token from this host — anonymous grant refused"
          : `crunchyroll streams fetch failed (HTTP ${status ?? "unknown"})`,
    };
  }

  const entry = d.data?.[0];
  let versions: CrStreamsVersion[] = entry?.versions || [];

  // fallback: dedicated streams endpoint shape
  if (!versions.length && entry?.streams) {
    const st = entry.streams as { versions?: CrStreamsVersion[] };
    versions = st.versions || [];
  }

  const wanted = audio ? audio.toLowerCase() : null;
  const playable = versions.filter(
    (v) => v.url && !v.drm_key_id && (!wanted || (v.audio_locale || "").toLowerCase().includes(wanted) || v.hardsub_locale),
  );
  const drmOnly = versions.length > 0 && playable.length === 0;

  return {
    headers: { "User-Agent": CR_UA },
    sources: playable.map((v) => ({
      url: v.url as string,
      isM3U8: /\.(m3u8)(\?|$)/i.test(v.url as string),
      quality: v.label || (v.hardsub_locale ? `hardsub-${v.hardsub_locale}` : "adaptive"),
      hardsubLocale: v.hardsub_locale ?? null,
      audioLocale: v.audio_locale ?? null,
      drm: false,
    })),
    drmOnly,
    error: drmOnly
      ? "all stream versions for this episode are DRM (Widevine) protected on the anonymous tier — playback requires an authenticated premium token; Ajest will show official links instead"
      : playable.length
        ? undefined
        : "no stream versions returned for this episode",
  };
}
