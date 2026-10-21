import type { RequestHandler } from "express";
import { paheAllEpisodes, paheSearch, paheSources } from "../../scrapers/animepahe/scrapers";

// /animepahe/search?keyword=
export const searchController: RequestHandler = async (req, res) => {
  const keyword = (req.query.keyword as string) || "";
  if (!keyword.trim()) {
    res.status(400).json({ error: "keyword required" });
    return;
  }
  try {
    res.status(200).json(await paheSearch(keyword.trim()));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      animes: [],
      error: (e as Error).message || "animepahe search failed",
    });
  }
};

// /animepahe/episodes/:slug
export const episodesController: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await paheAllEpisodes(req.params.slug));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      episodes: [],
      error: (e as Error).message || "animepahe episodes failed",
    });
  }
};

// /animepahe/sources?animeSession=&epSession=
export const sourcesController: RequestHandler = async (req, res) => {
  const animeSession = (req.query.animeSession as string) || "";
  const epSession = (req.query.epSession as string) || "";
  if (!animeSession || !epSession) {
    res.status(400).json({ error: "animeSession and epSession required" });
    return;
  }
  try {
    res.status(200).json(await paheSources(animeSession, epSession));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      sources: [],
      headers: {},
      anilistID: null,
      malID: null,
      error: (e as Error).message || "animepahe sources failed",
    });
  }
};
