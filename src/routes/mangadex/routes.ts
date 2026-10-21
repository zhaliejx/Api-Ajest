import { Router, type IRouter } from "express";
import {
  chapterController,
  infoController,
  searchController,
} from "../../controllers/mangadex/controllers";
import { cacheManager } from "../../middlewares/cache";

const mangadex_router: IRouter = Router();

mangadex_router.get("/", (_req, res) => {
  res.redirect("/");
});

// /mangadex/search?keyword=&page=&limit=
mangadex_router.get(
  "/search",
  cacheManager.middleware({
    duration: 3600,
    keyParams: ["keyword", "page", "limit"],
  }),
  searchController,
);

// /mangadex/manga/:id — info + chapter list
mangadex_router.get("/manga/:id", cacheManager.middleware(), infoController);

// /mangadex/chapter/:id — page image URLs (at-home server)
mangadex_router.get("/chapter/:id", cacheManager.middleware(), chapterController);

export default mangadex_router;
