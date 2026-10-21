import { Router, type IRouter } from "express";
import {
  searchController,
  seriesController,
  sourcesController,
} from "../../controllers/crunchyroll/controllers";
import { cacheManager } from "../../middlewares/cache";

const crunchyroll_router: IRouter = Router();

crunchyroll_router.get("/", (_req, res) => {
  res.redirect("/");
});

// /crunchyroll/search?keyword=
crunchyroll_router.get(
  "/search",
  cacheManager.middleware({ duration: 3600, keyParams: ["keyword"] }),
  searchController,
);

// /crunchyroll/series/:id — info + seasons + full episode list
crunchyroll_router.get("/series/:id", cacheManager.middleware(), seriesController);

// /crunchyroll/sources/:episodeId?audio=eng — anonymous-tier stream attempt
crunchyroll_router.get("/sources/:episodeId", cacheManager.middleware({ duration: 600 }), sourcesController);

export default crunchyroll_router;
