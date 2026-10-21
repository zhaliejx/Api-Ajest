import type { RequestHandler } from "express";
import { chapterPages, mangaInfo, searchManga } from "../../scrapers/mangadex/scrapers";

// /mangadex/search?keyword=&page=&limit=
export const searchController: RequestHandler = async (req, res) => {
  const keyword = (req.query.keyword as string) || "";
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(32, parseInt(req.query.limit as string, 10) || 20);
  if (!keyword.trim()) {
    res.status(400).json({ error: "keyword required" });
    return;
  }
  try {
    res.status(200).json(await searchManga(keyword.trim(), page, limit));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      error: (e as Error).message || "search failed",
    });
  }
};

// /mangadex/manga/:id
export const infoController: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await mangaInfo(req.params.id));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      error: (e as Error).message || "info failed",
    });
  }
};

// /mangadex/chapter/:id
export const chapterController: RequestHandler = async (req, res) => {
  try {
    res.status(200).json(await chapterPages(req.params.id));
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({
      error: (e as Error).message || "chapter fetch failed",
    });
  }
};
