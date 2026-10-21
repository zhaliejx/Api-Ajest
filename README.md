# ⚡ Anime-API Fork — Extended Providers ⚡

Fork of [falcon71181/Anime-API](https://github.com/falcon71181/Anime-API) (archived upstream)
that adds **four new providers** and fixes a cross-provider cache collision.

**Added in this fork:**

| Provider | Routes | What it gives | Notes |
|---|---|---|---|
| **AnimePahe** | `/animepahe/*` | search → episodes (paged) → kwik HLS sources with required headers | kwik rotates its challenge scheme; streams need residential-ish egress |
| **Crunchyroll** | `/crunchyroll/*` | official search → series/seasons/episodes → anonymous-tier stream attempt | **DRM (Widevine) content is reported, never bypassed.** Premium content returns `drmOnly: true` |
| **AnimeKai** | `/animekai/*` | search → series/episodes → servers → embed iframe URLs | player sources are token-encrypted upstream; embeds only, best-effort |
| **MangaDex** | `/mangadex/*` | **manga** search → series + chapter list → chapter page image URLs | legit public API — the most stable provider in this fork |

> **Why MangaDex instead of Bato.to?** bato.to has shut down (the domain now serves a
> closure page). MangaDex was chosen as the manga source: free public API, no scraping,
> no anti-bot. Set `MANGADEX_LANGS` (default `en,en-us`) to control chapter languages.

Upstream providers (aniwatch / gogoanime / kickassanime) are unchanged — see
[UPSTREAM_README.md](./UPSTREAM_README.md) for their full route documentation.

---

## New endpoints

### AnimePahe
```
GET /animepahe/search?keyword=frieren
GET /animepahe/episodes/{slug}                       # full paginated episode list
GET /animepahe/sources?animeSession={..}&epSession={..}
```
The sources response returns `headers` (Referer/User-Agent) that **must** be sent when
fetching the HLS manifest — pipe it through your own proxy like this fork's consumers do.

### Crunchyroll
```
GET /crunchyroll/search?keyword=frieren
GET /crunchyroll/series/{seriesId}                   # info + seasons + all episodes
GET /crunchyroll/sources/{episodeId}?audio=eng
```
Streams use the anonymous client grant (the same public client id Crunchyroll's own web
player ships — auto-scraped, or set `CR_CLIENT_ID`). Free/ad-tier episodes may return
playable HLS. If every version is DRM-protected the response is:
```json
{ "sources": [], "drmOnly": true, "error": "all stream versions ... require an authenticated premium token ..." }
```
This fork **does not and will not** circumvent Widevine DRM.

### AnimeKai
```
GET /animekai/search?keyword=frieren&page=1
GET /animekai/anime/{slug}
GET /animekai/servers?id={episodeSession}
GET /animekai/sources?id={serverId}
```
AnimeKai's titan player encrypts stream URLs with a live key from their JS bundle — that
scheme is out of scope here, so `sources` returns embed iframe URLs (`isEmbed: true`).

### MangaDex
```
GET /mangadex/search?keyword=frieren&limit=20&page=1
GET /mangadex/manga/{mangaId}                        # info + chapter list (paginated)
GET /mangadex/chapter/{chapterId}                    # page image URLs (at-home server)
```
Chapter pages point at MangaDex's `@home` CDN — hotlink them directly or proxy with the
`Referer` of your own app.

---

## Deploy

### Option A — Vercel (like upstream)

1. **Fork** this repository on GitHub (button: top-right *Fork*).
2. Clone your fork, commit your tweaks, push.
3. On [vercel.com](https://vercel.com) → **Add New Project** → **Import** your fork.
4. Framework preset: **Other**. Vercel auto-detects `api/index.ts` + `vercel.json` — no build settings needed.
5. Deploy. Your API is live at `https://<project>.vercel.app`.

### Option B — Self-host (recommended for the scraping providers)

Self-hosting fixes the #1 problem of Vercel deployments: **datacenter IPs get
Cloudflare-challenged** by animepahe / crunchyroll / hianime-class sites. A home box,
a VPS on a cleaner ASN, or a small free-tier VPS usually passes.

**Docker:**
```bash
docker build -t anime-api-fork .
docker run -d -p 3001:3001 \
  -e ANIMEPAHE_BASE=https://animepahe.com \
  --name anime-api anime-api-fork
```

**Bare Node (18+):**
```bash
npm install
npm run build
PORT=3001 npm start          # serves build/server.js
```

**Keep it alive** with systemd/pm2:
```bash
pm2 start build/server.js --name anime-api
pm2 save
```

> The Dockerfile installs Chromium for Puppeteer (Cloudflare fallback used by
> kickassanime + animekai). Vercel ignores it (serverless), Node builds skip it
> with `PUPPETEER_SKIP_DOWNLOAD=1 npm install`.

### Point Ajest at it
Whatever host you choose, set the resulting URL as the relay assist host in Ajest
(`RELAY_HOSTS` in `src/lib/ajest/upstream.ts`) — the `/gogoanime/search` contract is
identical to upstream, so it plugs straight in.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | server port (self-host only) |
| `ANIMEPAHE_BASE` | `https://animepahe.com` | entry domain (301s to the live TLD; override when rotation breaks) |
| `KWIK_BASE` | `https://kwik.si` | kwik host for source extraction |
| `CR_CLIENT_ID` | *(auto-scraped)* | Crunchyroll public web client id |
| `CRUNCHYROLL_BASE` | `https://www.crunchyroll.com` | CR origin |
| `ANIMEKAI_BASE` | `https://animekai.to` | animekai origin |
| `MANGADEX_API` | `https://api.mangadex.org` | MangaDex origin |
| `MANGADEX_COVERS` | `https://uploads.mangadex.org/covers` | cover image base |
| `MANGADEX_LANGS` | `en,en-us` | chapter languages (comma list) |
| `MANGADEX_CONTENT_RATING` | `safe,suggestive` | content rating filter |

---

## Honest status matrix (measured 2026-10-22 from a datacenter egress)

| Upstream | Reachable from datacenter | From residential | Provider state |
|---|---|---|---|
| MangaDex API | ✅ | ✅ | fully working (verified end-to-end) |
| AnimePahe | ❌ CF 403 | ✅ usually | code complete, egress-dependent |
| Crunchyroll | ❌ CF 403 | ✅ usually | code complete, egress-dependent; free-tier streams only, DRM reported honestly |
| AnimeKai | ❌ (site unreachable) | ✅ usually | code complete, best-effort; embeds only |
| AniWatch (hianime) | ❌ (upstream site down) | ? | unchanged upstream code |
| KickAssAnime | ❌ | ✅ | unchanged upstream code |
| bato.to | **shut down** | — | replaced by MangaDex |

Failures are always **structured JSON with an `error` message** (never hangs, never
HTML), so consumers can branch cleanly.

## Fixed in this fork (beyond providers)

- **Cache middleware collision**: `req.path` is relative inside sub-routers, so every
  provider's `/search?keyword=x` shared one cache key — `/crunchyroll/search` could serve
  `/animepahe/search`'s cached response. Keys now include `req.baseUrl`.
- **Root status timeouts**: `/` probed five dead sites sequentially with no timeout
  (15s+ hangs). Now parallel with a 6s cap.
