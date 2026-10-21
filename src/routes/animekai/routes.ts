import { Router, type IRouter } from "express";
import {
  searchController,
  seriesController,
  serversController,
  sourcesController,
} from "../../controllers/animekai/controllers";
import { cacheManager } from "../../middlewares/cache";

const animekai_router: IRouter = Router();

animekai_router.get("/", (_req, res) => {
  res.redirect("/");
});

// /animekai/search?keyword=&page=
animekai_router.get(
  "/search",
  cacheManager.middleware({ duration: 3600, keyParams: ["keyword", "page"] }),
  searchController,
);

// /animekai/anime/:slug
animekai_router.get("/anime/:slug", cacheManager.middleware(), seriesController);

// /animekai/servers?id={episodeSession}
animekai_router.get("/servers", cacheManager.middleware({ keyParams: ["id"] }), serversController);

// /animekai/sources?id={serverId}
animekai_router.get("/sources", cacheManager.middleware({ keyParams: ["id"] }), sourcesController);

export default animekai_router;
