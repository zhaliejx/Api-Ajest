import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  browserFetch,
  cfSolverConfigured,
  dropClearance,
  getClearanceFor,
  isBrowserRequired,
  looksChallenged,
  looksTarpitted,
  markBrowserRequired,
  solveViaFlareSolverr,
} from "./flaresolverr";
import { headers as baseHeaders } from "../config/headers";

// ── Drop-in Cloudflare clearance layer for axios instances ──────────────────
// Backed by FlareSolverr (github.com/FlareSolverr/FlareSolverr). Three tiers
// per domain: cookie fast path → solve-once + retry → full browser fetch for
// tarpitting domains (CF bot-fight hangs every non-browser connection).
// Without FLARESOLVERR_URL every wrapper behaves exactly like plain axios.

function applyClearance(cfg: InternalAxiosRequestConfig, clearance: { cookieHeader: string; userAgent: string }): void {
  cfg.headers["User-Agent"] = clearance.userAgent; // MUST match the solving browser
  if (clearance.cookieHeader) cfg.headers.Cookie = clearance.cookieHeader;
}

function absoluteUrl(cfg: InternalAxiosRequestConfig): string | null {
  const url = cfg.url || "";
  try {
    return new URL(url, cfg.baseURL).toString();
  } catch {
    return null;
  }
}

async function retryWithSolve(instance: AxiosInstance, cfg: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  const url = absoluteUrl(cfg);
  if (!url) throw new Error("cfAxios: cannot resolve request URL");
  dropClearance(url); // stale clearance — force a fresh solve
  const clearance = await solveViaFlareSolverr(url);
  cfg.__cfRetried = true;
  applyClearance(cfg, clearance);
  return cfg;
}

function obstacleHit(error: AxiosError): boolean {
  const status = error.response?.status;
  // CF 52x = edge could not reach origin — same stall family as tarpits,
  // and both are worth escalating to the browser tier.
  const cfEdgeStall = status !== undefined && status >= 520 && status <= 527;
  return looksChallenged(status, error.response?.data) || looksTarpitted(error) || cfEdgeStall;
}

/** Install the clearance interceptors on an axios instance (in place). */
export function installCfLayer(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use((cfg) => {
    const url = absoluteUrl(cfg);
    if (!url || !cfSolverConfigured()) return cfg;
    // domain already proved to tarpit non-browser connections → browser fetch
    if (isBrowserRequired(url)) {
      cfg.headers["X-Cf-Browser-Fetch"] = "1"; // handled by the request-error path below
    }
    const cached = getClearanceFor(url);
    if (cached) applyClearance(cfg, cached);
    return cfg;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const cfg = error.config as (InternalAxiosRequestConfig & { __cfRetried?: boolean }) | undefined;
      if (!cfg) throw error;

      // browser-fetch tier: either remembered for this domain, or the cleared
      // retry still stalled — fetch inside FlareSolverr and synthesize a response
      const url = absoluteUrl(cfg);
      const remembered = url ? isBrowserRequired(url) : false;
      if (cfSolverConfigured() && url && !cfg.__cfBrowserFetched && (remembered || (cfg.__cfRetried && obstacleHit(error)))) {
        if (remembered) markBrowserRequired(url);
        cfg.__cfBrowserFetched = true;
        const full = new URL(cfg.url || "", cfg.baseURL || undefined);
        if (cfg.params) {
          for (const [k, v] of Object.entries(cfg.params as Record<string, unknown>)) {
            full.searchParams.set(k, String(v));
          }
        }
        const solved = await browserFetch(full.toString());
        const synthetic: AxiosResponse = {
          data: solved.data,
          status: solved.status,
          statusText: "OK (via flaresolverr browser)",
          headers: {},
          config: cfg,
        };
        return synthetic;
      }

      if (!cfSolverConfigured()) throw error;
      if (cfg.__cfRetried) throw error;
      if (!obstacleHit(error)) throw error;
      return instance.request(await retryWithSolve(instance, cfg));
    },
  );

  // 200 responses whose body is still a challenge page (some CF configs)
  instance.interceptors.response.use(async (res) => {
    const cfg = res.config as InternalAxiosRequestConfig & { __cfRetried?: boolean; __cfBrowserFetched?: boolean };
    if (cfg.__cfRetried || cfg.__cfBrowserFetched || !cfSolverConfigured() || typeof res.data !== "string") return res;
    if (!looksChallenged(res.status, res.data)) return res;
    return instance.request(await retryWithSolve(instance, cfg));
  });

  return instance;
}

/** Ready-to-import axios instance with the layer installed. */
const cfAxios: AxiosInstance = installCfLayer(
  axios.create({
    timeout: 25000,
    headers: {
      "User-Agent": baseHeaders.USER_AGENT_HEADER,
      Accept: baseHeaders.ACCEPT_HEADER,
      "Accept-Encoding": baseHeaders.ACCEPT_ENCODEING_HEADER,
    },
  }),
);

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    __cfRetried?: boolean;
    __cfBrowserFetched?: boolean;
  }
}

// re-exports so scrapers can `import axios, { AxiosError } from "../utils/cfAxios"`
export { AxiosError, isAxiosError } from "axios";
export type { AxiosInstance, AxiosResponse, AxiosAdapter, InternalAxiosRequestConfig } from "axios";

export default cfAxios;
