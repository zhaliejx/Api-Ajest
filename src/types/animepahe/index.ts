// ── AnimePahe types ──────────────────────────────────────────────────────────

export interface PaheSearchResult {
  id: number;
  slug: string;
  name: string;
  poster?: string;
  type?: string;
}

export interface ScrapedPaheSearch {
  animes: {
    id: string; // slug used by /anime/{slug}
    name: string;
    img: string | null;
    type?: string;
  }[];
  hasNextPage: boolean;
}

export interface PaheReleaseEntry {
  session: string;
  title: string;
  episode: string;
  snapshot?: string;
  created_at?: string;
  audio?: string; // "jpn" | "eng"
  duration?: string;
}

export interface ScrapedPaheEpisodes {
  animeId: string; // internal numeric id (release API id)
  animeName: string;
  animeSession: string; // /play/{animeSession}/{epSession}
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  episodes: {
    number: number;
    session: string;
    title: string;
    audio: string;
    snapshot: string | null;
    duration: string | null;
  }[];
}

export interface ScrapedPaheSources {
  headers: {
    Referer: string;
    "User-Agent": string;
    Cookie?: string;
  };
  sources: {
    url: string;
    isM3U8: boolean;
    quality?: string;
    audio?: string;
    kwikUrl: string;
  }[];
  anilistID: number | null;
  malID: number | null;
  error?: string;
}
