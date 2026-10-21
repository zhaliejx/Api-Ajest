import createHttpError from "http-errors";
import {
  coverUrl,
  mdGet,
  pickLocalized,
  MD_LANGS,
} from "../../utils/mangadex/constants";
import type {
  MangaDexManga,
  MangaDexRelationship,
  ScrapedChapterPages,
  ScrapedMangaInfo,
  ScrapedMangaSearch,
  MangaChapter,
} from "../../types/mangadex";

const COMMON_PARAMS = "includes[]=cover_art&includes[]=author&includes[]=artist";

function firstRel(
  rels: MangaDexRelationship[] | undefined,
  type: string,
): MangaDexRelationship | undefined {
  return rels?.find((r) => r.type === type);
}

function mapSearchItem(m: MangaDexManga) {
  const coverRel = firstRel(m.relationships, "cover_art");
  return {
    id: m.id,
    title: pickLocalized(m.attributes.title) || "(untitled)",
    altTitle: pickLocalized(m.attributes.altTitles?.[0]) || undefined,
    cover: coverUrl(m.id, coverRel?.attributes?.fileName),
    year: m.attributes.year ?? null,
    status: m.attributes.status || "unknown",
    contentRating: m.attributes.contentRating,
    tags: (m.attributes.tags || []).map((t) => pickLocalized(t.attributes.name) || t.id),
    originalLanguage: m.attributes.originalLanguage,
  };
}

// ── GET /manga?title=&limit=&offset=&contentRating[]=&order[relevance]=desc ─
export async function searchManga(
  keyword: string,
  page = 1,
  limit = 20,
): Promise<ScrapedMangaSearch> {
  const offset = (Math.max(1, page) - 1) * limit;
  const ratings = (process.env.MANGADEX_CONTENT_RATING || "safe,suggestive")
    .split(",")
    .map((r) => `contentRating[]=${encodeURIComponent(r.trim())}`)
    .join("&");
  const langs = MD_LANGS.map((l) => `availableTranslatedLanguage[]=${encodeURIComponent(l.trim())}`).join("&");
  const url =
    `/manga?title=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}` +
    `&${ratings}&${langs}&${COMMON_PARAMS}&order[relevance]=desc&hasAvailableChapters=true`;
  try {
    const d = await mdGet<{
      result: string;
      total: number;
      data: MangaDexManga[];
    }>(url);
    return {
      mangas: d.data.map(mapSearchItem),
      currentPage: page,
      hasNextPage: offset + limit < d.total,
      total: d.total,
    };
  } catch (e) {
    throw createHttpError(
      (e as { response?: { status?: number } })?.response?.status || 502,
      "MangaDex search failed — upstream unreachable or rate-limited",
    );
  }
}

// ── GET /manga/:id + /chapter?manga= (chapter list with fallback) ────────────
export async function mangaInfo(id: string): Promise<ScrapedMangaInfo> {
  try {
    const detail = await mdGet<{ data: MangaDexManga }>(`/manga/${id}?${COMMON_PARAMS}`);

    const m = detail.data;
    const coverRel = firstRel(m.relationships, "cover_art");

    const langs = MD_LANGS.map((l) => `translatedLanguage[]=${encodeURIComponent(l.trim())}`).join("&");
    // MangaDex caps /chapter?limit at 100 — paginate.
    const chapterQuery = (langFilter: boolean, offset: number) =>
      `/chapter?manga=${id}&limit=100&offset=${offset}&order[volume]=asc&order[chapter]=asc` +
      `&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica` +
      (langFilter ? `&${langs}` : "");

    interface ChResp {
      total: number;
      data: MangaChapterItem[];
    }
    const fetchAll = async (langFilter: boolean): Promise<ChResp> => {
      const all: MangaChapterItem[] = [];
      let total = 0;
      for (let page = 0; page < 15; page++) {
        const d = await mdGet<ChResp>(chapterQuery(langFilter, page * 100));
        total = d.total ?? 0;
        all.push(...(d.data || []));
        if (all.length >= total || !d.data?.length) break;
      }
      return { total, data: all };
    };

    let chapterData: ChResp = { total: 0, data: [] };
    try {
      chapterData = await fetchAll(true);
    } catch {
      /* fall through to unfiltered */
    }
    if (!chapterData.data.length) {
      try {
        chapterData = await fetchAll(false);
      } catch {
        /* genuinely chapterless manga */
      }
    }

    const chapters: MangaChapter[] = chapterData.data.map((c) => ({
      id: c.id,
      chapter: c.attributes.chapter ?? null,
      title: pickLocalized(c.attributes.title as Record<string, string> | undefined),
      volume: c.attributes.volume ?? null,
      pages: c.attributes.pages ?? 0,
      externalUrl: c.attributes.externalUrl ?? null,
      translatedLanguage: c.attributes.translatedLanguage ?? "",
      publishAt: c.attributes.publishAt || c.attributes.createdAt || "",
    }));
    chapters.sort(
      (a, b) => (parseFloat(a.chapter || "0") || 0) - (parseFloat(b.chapter || "0") || 0),
    );

    return {
      info: {
        id: m.id,
        title: pickLocalized(m.attributes.title) || "(untitled)",
        altTitles: (m.attributes.altTitles || [])
          .map((t) => pickLocalized(t))
          .filter((x): x is string => !!x)
          .slice(0, 8),
        description: pickLocalized(m.attributes.description) || "",
        cover: coverUrl(m.id, coverRel?.attributes?.fileName),
        status: m.attributes.status || "unknown",
        year: m.attributes.year ?? null,
        contentRating: m.attributes.contentRating,
        authors: (m.relationships || [])
          .filter((r) => r.type === "author")
          .map((r) => (r.attributes as { name?: string } | undefined)?.name)
          .filter((x): x is string => !!x),
        artists: (m.relationships || [])
          .filter((r) => r.type === "artist")
          .map((r) => (r.attributes as { name?: string } | undefined)?.name)
          .filter((x): x is string => !!x),
        tags: (m.attributes.tags || []).map((t) => pickLocalized(t.attributes.name) || t.id),
        lastChapter: m.attributes.lastChapter ?? null,
      },
      chapters,
      totalChapters: chapters.length,
    };
  } catch (e) {
    throw createHttpError(
      (e as { response?: { status?: number } })?.response?.status || 502,
      "MangaDex info failed — bad id or upstream unreachable",
    );
  }
}

interface MangaChapterItem {
  id: string;
  attributes: {
    chapter?: string | null;
    title?: Record<string, string> | string | null;
    volume?: string | null;
    pages?: number;
    externalUrl?: string | null;
    translatedLanguage?: string;
    publishAt?: string;
    createdAt?: string;
  };
}

// ── GET /chapter/:id + /at-home/server/:id ───────────────────────────────────
export async function chapterPages(chapterId: string): Promise<ScrapedChapterPages> {
  try {
    const ch = await mdGet<{ data: { id: string; attributes: Record<string, unknown> } }>(
      `/chapter/${chapterId}`,
    );
    const atHome = await mdGet<{
      baseUrl: string | null;
      chapter: { hash: string; data: string[]; dataSaver: string[] };
    }>(`/at-home/server/${chapterId}`);

    const a = ch.data.attributes as {
      chapter: string | null;
      title: string | null;
      pages: number;
      externalUrl: string | null;
      translatedLanguage: string;
      publishAt: string;
    };
    const mangaRel = (ch.data as unknown as { relationships?: MangaDexRelationship[] }).relationships?.find(
      (r) => r.type === "manga",
    );

    const build = (files: string[]) =>
      atHome.baseUrl && atHome.chapter.hash
        ? files.map((f) => `${atHome.baseUrl}/data/${atHome.chapter.hash}/${f}`)
        : [];

    return {
      chapter: a.chapter,
      title: a.title,
      mangaId: mangaRel?.id ?? null,
      pages: build(atHome.chapter.data || []),
      dataSaverPages: build(atHome.chapter.dataSaver || []),
      hash: atHome.chapter.hash,
      baseUrl: atHome.baseUrl,
    };
  } catch (e) {
    throw createHttpError(
      (e as { response?: { status?: number } })?.response?.status || 502,
      "MangaDex chapter fetch failed — external chapters cannot return pages",
    );
  }
}
