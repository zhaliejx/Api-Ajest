type WebsiteConfig = {
  BASE: string;
};

export type AnimeWebsiteConfig = WebsiteConfig & {
  CLONES?: Record<string, string[]>;
};

type Websites = Record<string, AnimeWebsiteConfig>;

// anime websites and their clones
export const websites_collection: Websites = {
  AniWatch: {
    BASE: "https://aniwatchtv.to",
    CLONES: {
      HiAnime: [
        "https://hianimez.is",
        "https://hianimez.to",
        "https://hianime.nz",
        "https://hianime.bz",
        "https://hianime.pe",
      ],
    },
  },
  GogoAnime: {
    BASE: "https://ww24.gogoanimes.fi",
  },
  KickAssAnime: {
    BASE: "https://kickass-anime.ro",
  },
  AnimePahe: {
    // animepahe rotates TLDs; the entry domain 301s to the current one.
    // Override with ANIMEPAHE_BASE env when rotation breaks the default.
    BASE: process.env.ANIMEPAHE_BASE || "https://animepahe.com",
  },
  Crunchyroll: {
    BASE: process.env.CRUNCHYROLL_BASE || "https://www.crunchyroll.com",
  },
  AnimeKai: {
    BASE: process.env.ANIMEKAI_BASE || "https://animekai.to",
  },
  MangaDex: {
    BASE: process.env.MANGADEX_API || "https://api.mangadex.org",
  },
};
