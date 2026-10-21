// ── AnimeKai types (hianime-class site; structure mirrors aniwatch shapes) ───

export interface KaiSearchResult {
  animes: {
    id: string; // slug
    name: string;
    img: string | null;
    jname?: string;
    duration?: string | null;
    type?: string | null;
    sub: number;
    dub: number;
    episodes: number;
  }[];
  hasNextPage: boolean;
  currentPage: number;
  totalPages: number;
  error?: string;
}

export interface KaiEpisode {
  number: number;
  session: string; // watch/{animeSession}?ep={epSession} style id
  title: string | null;
  isFiller: boolean;
}

export interface KaiSeriesInfo {
  info: {
    id: string; // slug
    name: string;
    jname?: string;
    img: string | null;
    description: string;
    type: string | null;
    status: string | null;
    airedDate: string | null;
    genres: string[];
    studios: string[];
  };
  seasons: { id: string; name: string; isCurrent: boolean }[];
  episodes: KaiEpisode[];
  error?: string;
}

export interface KaiEpisodeServers {
  episodeId: string;
  sub: { serverName: string; serverId: string }[];
  dub: { serverName: string; serverId: string }[];
  error?: string;
}

export interface KaiSources {
  headers: Record<string, string>;
  sources: {
    url: string;
    isM3U8: boolean;
    quality?: string;
    isEmbed?: boolean;
  }[];
  subtitles?: { lang: string; url: string }[];
  anilistID: number | null;
  malID: number | null;
  error?: string;
}
