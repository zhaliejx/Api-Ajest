import type { RequestHandler } from "express";
import {
  kaiSearch,
  kaiSeries,
  kaiServers,
  kaiSources,
} from "../../scrapers/animekai/scrapers";

// /animekai/search?keyword=&page=
export const searchController: RequestHandler = async (req, res) => {
  const keyword = (req.query.keyword as string) || "";
  const page = parseInt(req.query.page as string, 10) || 1;
  if (!keyword.trim()) {
    res.status(400).json({ error: "keyword required" });
    return;
  }
  try {
    res.status(200).json(await kaiSearch(keyword.trim(), page));
  } catch (e) {
    res.status(502).json({
      animes: [],
      hasNextPage: false,
      currentPage: page,
      totalPages: 1,
      error: (e as Error).message || "animekai search failed",
    });
  }
};

// /animekai/anime/:slug
export const seriesController: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await kaiSeries(req.params.slug));
  } catch (e) {
    res.status(502).json({
      info: null,
      seasons: [],
      episodes: [],
      error: (e as Error).message || "animekai series failed",
    });
  }
};

// /animekai/servers?id={episodeSession}
export const serversController: RequestHandler = async (req, res) => {
  const id = (req.query.id as string) || "";
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  try {
    res.status(200).json(await kaiServers(id));
  } catch (e) {
    res.status(502).json({
      episodeId: id,
      sub: [],
      dub: [],
      error: (e as Error).message || "animekai servers failed",
    });
  }
};

// /animekai/sources?id={serverId}
export const sourcesController: RequestHandler = async (req, res) => {
  const id = (req.query.id as string) || "";
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }
  try {
    const r = await kaiSources(id);
    res.status(200).json({
      headers: { Referer: "https://animekai.to/" },
      sources: r.iframeUrls.map((u) => ({ url: u, isM3U8: false, isEmbed: true, quality: "embed" })),
      anilistID: null,
      malID: null,
      error: r.iframeUrls.length ? undefined : r.note,
    });
  } catch (e) {
    res.status(502).json({
      sources: [],
      anilistID: null,
      malID: null,
      error: (e as Error).message || "animekai sources failed",
    });
  }
};
