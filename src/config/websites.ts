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
    // ww24.gogoanimes.fi 301s every request to www.gogoanime.is (current
    // canonical clone) — targeting .is directly avoids the redirect hop and
    // keeps search/category scraping fast. ww24 kept as a clone fallback.
    BASE: "https://www.gogoanime.is",
    CLONES: {
      GogoAnimesFi: ["https://ww24.gogoanimes.fi"],
    },
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
    // animekai.to lost its DNS (Oct 2026) — the live domain is .cc
    BASE: process.env.ANIMEKAI_BASE || "https://animekai.cc",
  },
  MangaDex: {
    BASE: process.env.MANGADEX_API || "https://api.mangadex.org",
  },
};
