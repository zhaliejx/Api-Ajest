import { Router, type IRouter } from "express";
import {
  episodesController,
  searchController,
  sourcesController,
} from "../../controllers/animepahe/controllers";
import { cacheManager } from "../../middlewares/cache";

const animepahe_router: IRouter = Router();

animepahe_router.get("/", (_req, res) => {
  res.redirect("/");
});

// /animepahe/search?keyword=
animepahe_router.get(
  "/search",
  cacheManager.middleware({ duration: 3600, keyParams: ["keyword"] }),
  searchController,
);

// /animepahe/episodes/:slug
animepahe_router.get("/episodes/:slug", cacheManager.middleware(), episodesController);

// /animepahe/sources?animeSession=&epSession=
animepahe_router.get(
  "/sources",
  cacheManager.middleware({ duration: 600, keyParams: ["animeSession", "epSession"] }),
  sourcesController,
);

export default animepahe_router;
