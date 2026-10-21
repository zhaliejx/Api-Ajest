import type { RequestHandler } from "express";
import {
  crEpisodeSources,
  crSearch,
  crSeries,
} from "../../scrapers/crunchyroll/scrapers";

// /crunchyroll/search?keyword=
export const searchController: RequestHandler = async (req, res) => {
  const keyword = (req.query.keyword as string) || "";
  if (!keyword.trim()) {
    res.status(400).json({ error: "keyword required" });
    return;
  }
  try {
    res.status(200).json(await crSearch(keyword.trim()));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      animes: [],
      error: (e as Error).message || "crunchyroll search failed",
    });
  }
};

// /crunchyroll/series/:id
export const seriesController: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await crSeries(req.params.id));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      info: null,
      seasons: [],
      episodes: [],
      error: (e as Error).message || "crunchyroll series failed",
    });
  }
};

// /crunchyroll/sources/:episodeId?audio=eng
export const sourcesController: RequestHandler = async (req, res) => {
  const audio = (req.query.audio as string) || undefined;
  try {
    res.status(200).json(await crEpisodeSources(req.params.episodeId, audio));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      sources: [],
      drmOnly: false,
      error: (e as Error).message || "crunchyroll sources failed",
    });
  }
};
