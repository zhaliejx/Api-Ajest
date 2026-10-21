import type { GetRoot } from "../types/aniwatch/root";
import type { RequestHandler } from "express";
import { isSiteReachable } from "./isSiteReachable";
import { paheBase } from "../utils/animepahe/constants";
import { KAI_BASE } from "../utils/animekai/constants";

// TODO: make config json files , make it better in future
export const getRoot: RequestHandler = async (_req, res) => {
  try {
    const data: GetRoot = {
      docs: "",
      sites: {},
    };

    data.docs =
      "https://github.com/falcon71181/Anime-API/blob/main/README.md (see fork README for the new providers)";

    const [aniwatchStatus, aniwatchtvStatus, gogoanimeStatus, paheStatus, kaiStatus] =
      await Promise.all([
        isSiteReachable("https://aniwatch.to"),
        isSiteReachable("https://aniwatchtv.to"),
        isSiteReachable("https://gogoanime3.co"),
        isSiteReachable(paheBase()),
        isSiteReachable(KAI_BASE),
      ]);

    data.sites["aniwatch"] = aniwatchStatus || aniwatchtvStatus;
    data.sites["gogoanime"] = gogoanimeStatus;
    data.sites["animepahe"] = paheStatus;
    data.sites["animekai"] = kaiStatus;
    // crunchyroll + mangadex are official/public APIs — assumed reachable
    data.sites["crunchyroll"] = true;
    data.sites["mangadex"] = true;

    res.status(200).json(data);
  } catch (error) {
    console.log(error);
  }
};
