import axios from "axios";
import createHttpError from "http-errors";
import { headers as baseHeaders } from "../config/headers";

// ── FlareSolverr-assisted Cloudflare clearance layer ─────────────────────────
// Deploy FlareSolverr (github.com/FlareSolverr/FlareSolverr) anywhere reachable
// — e.g. a second free Render service from the official docker image — and set
//   FLARESOLVERR_URL=https://<solver-host>
// on this API. The layer then escalates in three tiers per domain:
//   1. plain axios (fast path), reusing cached cf_clearance cookies
//   2. on a challenge (403/503/challenge body) OR a network-level tarpit
//      (timeout with no response — CF's bot-fight hang), solve once through
//      FlareSolverr's real browser, cache {cookies + user-agent}, retry
//   3. if even the cleared connection stalls (some domains tarpit ALL
//      non-browser TLS regardless of cookies), fall back to fetching the URL
//      inside FlareSolverr's browser and remember "browser required" for the
//      domain so later requests skip the doomed fast paths.
// Without FLARESOLVERR_URL the layer is fully transparent: cfGet == axios.get.

const SOLVER_URL = (process.env.FLARESOLVERR_URL || "").trim().replace(/\/+$/, "");
const SOLVE_TIMEOUT_MS = Number(process.env.FLARESOLVERR_MAX_TIMEOUT_MS || 150000);
const CLEARANCE_TTL_MS = 35 * 60_000;

export interface Clearance {
  cookieHeader: string;
  userAgent: string;
  solvedAt: number;
}

interface DomainState {
  clearance?: Clearance;
  browserRequired?: boolean;
  updatedAt: number;
}

const domainState = new Map<string, DomainState>();

export function cfSolverConfigured(): boolean {
  return Boolean(SOLVER_URL);
}

export function cfClearanceStatus(): {
  configured: boolean;
  domains: Array<{ domain: string; ageMinutes: number; browserRequired: boolean }>;
} {
  return {
    configured: Boolean(SOLVER_URL),
    domains: Array.from(domainState.entries()).map(([domain, s]) => ({
      domain,
      ageMinutes: Math.round((Date.now() - s.updatedAt) / 60000),
      browserRequired: Boolean(s.browserRequired),
    })),
  };
}

/** cf_clearance is issued for the registrable domain + UA + egress IP. */
function registrableDomain(host: string): string {
  const labels = host.split(".");
  return labels.length > 2 ? labels.slice(-2).join(".") : host;
}

function stateFor(url: string): DomainState {
  const dom = registrableDomain(new URL(url).host);
  let s = domainState.get(dom);
  if (!s || Date.now() - s.updatedAt > CLEARANCE_TTL_MS) {
    s = { updatedAt: Date.now() };
    domainState.set(dom, s);
  }
  return s;
}

export function getClearanceFor(url: string): Clearance | undefined {
  return stateFor(url).clearance;
}

export function isBrowserRequired(url: string): boolean {
  return Boolean(stateFor(url).browserRequired);
}

export function storeClearance(url: string, clearance: Clearance): void {
  const s = stateFor(url);
  s.clearance = clearance;
  s.updatedAt = Date.now();
}

export function markBrowserRequired(url: string): void {
  const s = stateFor(url);
  s.browserRequired = true;
  s.updatedAt = Date.now();
}

export function dropClearance(url: string): void {
  const s = stateFor(url);
  s.clearance = undefined;
  s.updatedAt = Date.now();
}

export function newClearance(cookieHeader: string, userAgent: string): Clearance {
  return { cookieHeader, userAgent, solvedAt: Date.now() };
}

export function looksChallenged(status: number | undefined, body: unknown): boolean {
  if (status === 403 || status === 503) return true;
  if (typeof body === "string") {
    const b = body.slice(0, 4000);
    if (
      b.includes("Just a moment") ||
      b.includes("cf-chl") ||
      b.includes("challenge-platform") ||
      b.includes("cf-browser-verification") ||
      b.includes("_cf_chl_opt") ||
      b.includes("Attention Required! | Cloudflare")
    ) {
      return true;
    }
  }
  return false;
}

/** True for connection-level stalls (CF bot-fight tarpit) with no HTTP response. */
export function looksTarpitted(error: unknown): boolean {
  const e = error as { response?: unknown; code?: string; message?: string };
  if (e?.response) return false; // got an HTTP response — not a tarpit
  const code = e?.code || "";
  const msg = e?.message || "";
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    /timeout.*exceeded/i.test(msg)
  );
}

async function callFlareSolverr(url: string): Promise<{
  status?: string;
  message?: string;
  solution?: { status?: number; userAgent?: string; response?: string; cookies?: Array<{ name: string; value: string }> };
}> {
  if (!SOLVER_URL) throw createHttpError(502, "cloudflare obstacle encountered but FLARESOLVERR_URL is not configured");
  try {
    const res = await axios.post(
      `${SOLVER_URL}/v1`,
      { cmd: "request.get", url, maxTimeout: 90000 },
      { timeout: SOLVE_TIMEOUT_MS, headers: { "Content-Type": "application/json" } },
    );
    return res.data;
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 120);
    throw createHttpError(502, `flaresolverr unreachable or timed out: ${msg}`);
  }
}

/** Solve the challenge for url and cache the clearance cookies + UA. */
export async function solveViaFlareSolverr(url: string): Promise<Clearance> {
  const data = await callFlareSolverr(url);
  if (data?.status !== "ok" || !data?.solution) {
    throw createHttpError(502, `flaresolverr could not solve challenge: ${(data?.message || "unknown").slice(0, 140)}`);
  }
  const cookieHeader = (data.solution.cookies || [])
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const clearance: Clearance = {
    cookieHeader,
    userAgent: data.solution.userAgent || baseHeaders.USER_AGENT_HEADER,
    solvedAt: Date.now(),
  };
  storeClearance(url, clearance);
  return clearance;
}

/** Fetch url inside FlareSolverr's browser (last-resort tier for tarpitting
 * domains). Returns the response body — JSON parsed when possible. */
export async function browserFetch<T = unknown>(url: string): Promise<{ data: T; status: number }> {
  const data = await callFlareSolverr(url);
  if (data?.status !== "ok" || !data?.solution) {
    throw createHttpError(502, `flaresolverr browser fetch failed: ${(data?.message || "unknown").slice(0, 140)}`);
  }
  markBrowserRequired(url);
  let body: unknown = data.solution.response ?? "";
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        body = JSON.parse(trimmed);
      } catch {
        /* keep raw text */
      }
    }
  }
  return { data: body as T, status: data.solution.status || 200 };
}

export interface CfGetOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  maxRedirects?: number;
}

function withParams(url: string, params?: Record<string, unknown>): string {
  if (!params || !Object.keys(params).length) return url;
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.toString();
  } catch {
    return url;
  }
}

/** axios.get with the three-tier clearance layer. Throws the same axios errors
 * for non-challenge failures (404 etc.), so existing scraper catch blocks keep
 * working. */
export async function cfGet<T = unknown>(
  url: string,
  opts: CfGetOptions = {},
): Promise<{ data: T; status: number }> {
  const attempt = async (clearance?: Clearance) => {
    const h: Record<string, string> = { ...(opts.headers || {}) };
    if (clearance) {
      h["User-Agent"] = clearance.userAgent; // MUST match the solving browser
      if (clearance.cookieHeader) h.Cookie = clearance.cookieHeader;
    }
    return axios.get(url, {
      params: opts.params,
      headers: h,
      timeout: opts.timeout ?? 15000,
      maxRedirects: opts.maxRedirects ?? 5,
    });
  };

  const state = stateFor(url);

  // ── tier 3 remembered: go straight to the browser ─────────────────────────
  if (state.browserRequired) {
    return browserFetch<T>(withParams(url, opts.params));
  }

  // ── tier 1: cached clearance fast path, then plain fast path ──────────────
  let challengeHit = false;
  for (const clearance of [getClearanceFor(url), undefined]) {
    try {
      const res = await attempt(clearance);
      if (!looksChallenged(res.status, res.data)) return res;
      challengeHit = true;
      dropClearance(url);
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (looksChallenged(status, undefined)) {
        challengeHit = true;
        dropClearance(url);
      } else if (looksTarpitted(e)) {
        challengeHit = true; // treat the stall as an obstacle worth solving
      } else {
        throw e; // real error (404, DNS, …) — propagate untouched
      }
    }
    if (!challengeHit && clearance) break; // cached clearance worked
  }

  // ── tier 2: solve once, cache, retry ──────────────────────────────────────
  const clearance = await solveViaFlareSolverr(url);
  try {
    const res = await attempt(clearance);
    if (!looksChallenged(res.status, res.data)) return res;
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    const cfEdgeStall = status !== undefined && status >= 520 && status <= 527;
    if (looksChallenged(status, undefined) || looksTarpitted(e) || cfEdgeStall) {
      // ── tier 3: cleared-but-stalled → fetch inside the browser ────────────
      return browserFetch<T>(withParams(url, opts.params));
    }
    throw e;
  }
  // challenge survived the cleared retry (some configs)
  return browserFetch<T>(withParams(url, opts.params));
}
