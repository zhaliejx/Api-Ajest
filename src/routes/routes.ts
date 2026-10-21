import aniwatch_router from "./aniwatch/routes";
import gogoanime_router from "./gogoanime/routes";
import kickassanime_router from "./kickassanime/routes";
import animepahe_router from "./animepahe/routes";
import crunchyroll_router from "./crunchyroll/routes";
import animekai_router from "./animekai/routes";
import mangadex_router from "./mangadex/routes";
import { getRoot } from "../lib/getRoot";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

// /
router.get("/", getRoot);

// health check API
router.get("/health", (_req, res) => {
  res.sendStatus(200);
});

// aniwatch, hianime, zoro
router.use("/aniwatch", aniwatch_router);
router.use("/hianime", aniwatch_router);
router.use("/zoro", aniwatch_router);

// gogoanime, anitaku
router.use("/gogoanime", gogoanime_router);
router.use("/anitaku", gogoanime_router);

// kickassanime
router.use("/kickassanime", kickassanime_router);

// animepahe (kwik HLS)
router.use("/animepahe", animepahe_router);

// crunchyroll (official API, anonymous grant; DRM reported honestly)
router.use("/crunchyroll", crunchyroll_router);

// animekai (hianime-class, token-guarded ajax best-effort)
router.use("/animekai", animekai_router);

// mangadex (legit public API — manga search/info/chapter pages)
router.use("/mangadex", mangadex_router);

export { router };
