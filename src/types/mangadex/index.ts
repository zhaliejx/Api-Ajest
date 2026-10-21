// ── MangaDex public API types (legit JSON API, no scraping required) ─────────

export interface MangaDexCoverAttributes {
  fileName?: string;
  volume?: string | null;
  description?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface MangaDexRelationship {
  id: string;
  type: string; // cover_art | author | artist | etc.
  attributes?: MangaDexCoverAttributes & Record<string, unknown>;
}

export interface MangaDexTitleAttributes {
  title: Record<string, string>;
  altTitles: Record<string, string>[];
  description: Record<string, string>;
  originalLanguage?: string;
  lastVolume?: string | null;
  lastChapter?: string | null;
  publicationDemographic?: string | null;
  status?: string;
  year?: number | null;
  contentRating?: string;
  tags?: { id: string; type: string; attributes: { name: Record<string, string> } }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MangaDexManga {
  id: string;
  type: "manga";
  attributes: MangaDexTitleAttributes;
  relationships?: MangaDexRelationship[];
}

export interface SearchedManga {
  id: string;
  title: string;
  altTitle?: string;
  cover: string | null;
  year: number | null;
  status: string;
  contentRating?: string;
  tags: string[];
  originalLanguage?: string;
}

export interface ScrapedMangaSearch {
  mangas: SearchedManga[];
  currentPage: number;
  hasNextPage: boolean;
  total: number;
}

export interface MangaChapter {
  id: string;
  chapter: string | null;
  title: string | null;
  volume: string | null;
  pages: number;
  externalUrl: string | null;
  translatedLanguage: string;
  publishAt: string;
}

export interface ScrapedMangaInfo {
  info: {
    id: string;
    title: string;
    altTitles: string[];
    description: string;
    cover: string | null;
    status: string;
    year: number | null;
    contentRating?: string;
    authors: string[];
    artists: string[];
    tags: string[];
    lastChapter: string | null;
  };
  chapters: MangaChapter[];
  totalChapters: number;
}

export interface ScrapedChapterPages {
  chapter: string | null;
  title: string | null;
  mangaId: string | null;
  pages: string[];
  dataSaverPages: string[];
  hash: string;
  baseUrl: string | null;
}
