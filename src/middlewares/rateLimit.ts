import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  // 600/hour per IP: this API doubles as a relay-search node — callers race
  // several keyword variants per title in parallel (Ajest sends 3-4 per
  // resolution), so the upstream 50/hour budget 429'd during normal browsing.
  // 600 still caps sustained abuse at ~10 req/min per IP.
  max: 600,
  standardHeaders: "draft-7", // Set `RateLimit` and `RateLimit-Policy`` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message:
    "Too many requests from this IP, please try again after 1 hour",
});
