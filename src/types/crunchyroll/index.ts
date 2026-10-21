// ── Crunchyroll public API types (v2 CMS, anonymous client grant) ────────────

export interface CrTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  account_id?: string;
}

export interface CrImage {
  url?: string[] | string;
  type?: string;
  width?: number;
  height?: number;
}

export interface CrItem {
  id: string;
  type: string; // series | season | episode | movie
  title?: string;
  slug_title?: string;
  description?: string;
  series_metadata?: Record<string, unknown>;
  season_metadata?: Record<string, unknown>;
  episode_metadata?: {
    series_id?: string;
    season_id?: string;
    season_title?: string;
    episode?: string;
    episode_number?: string;
    title?: string;
    description?: string;
    images?: { thumbnail?: CrImage[] }[];
    audio_locales?: string[];
    subtitle_locales?: string[];
    is_dubbed?: boolean;
    is_subbed?: boolean;
    duration_ms?: number;
    display_episode_number?: string;
  };
  images?: { thumbnail?: CrImage[] }[];
}

export interface CrSearchResponse {
  total?: number;
  data?: { type: string; count?: number; items?: CrItem[] }[];
}

export interface CrListResponse {
  total?: number;
  data?: CrItem[];
}

export interface CrStreamsVersion {
  audio_locale?: string;
  hardsub_locale?: string | null;
  url?: string;
  token?: string;
  drm_key_id?: string | null;
  label?: string;
}

export interface CrStreamsResponse {
  total?: number;
  data?: {
    id?: string;
    versions?: CrStreamsVersion[];
    __links__?: Record<string, unknown>;
    streams?: unknown;
  }[];
}

// ── API-facing shapes ────────────────────────────────────────────────────────

export interface CrSearchResult {
  animes: {
    id: string;
    name: string;
    slug: string;
    img: string | null;
    description: string;
    isDubbed: boolean;
    isSubbed: boolean;
    audioLocales: string[];
  }[];
  error?: string;
}

export interface CrEpisode {
  id: string;
  number: string;
  title: string;
  seasonId: string;
  seasonTitle: string;
  thumb: string | null;
  durationMs: number | null;
  isDubbed: boolean;
  isSubbed: boolean;
  audioLocales: string[];
  subtitleLocales: string[];
  slug: string;
}

export interface CrSeriesInfo {
  info: {
    id: string;
    name: string;
    slug: string;
    description: string;
    img: string | null;
    isDubbed: boolean;
    isSubbed: boolean;
    audioLocales: string[];
    maturityRatings: string[];
  };
  seasons: {
    id: string;
    title: string;
    number: number | null;
    episodesCountHint?: number;
  }[];
  episodes: CrEpisode[];
  error?: string;
}

export interface CrEpisodeSources {
  headers: Record<string, string>;
  sources: {
    url: string;
    isM3U8: boolean;
    quality?: string;
    hardsubLocale: string | null;
    audioLocale: string | null;
    drm: boolean;
  }[];
  drmOnly: boolean;
  error?: string;
}
