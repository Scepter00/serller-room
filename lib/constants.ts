/** Serller shared constants. */

export const APP_NAME = "Serller";
export const APP_TAGLINE = "The social network on Stellar.";

/** Session cookie name (httpOnly JWT). */
export const SESSION_COOKIE = "serller_session";
/** Custom header required on state-changing requests (CSRF belt-and-braces). */
export const CSRF_HEADER = "x-serller-csrf";

/** Wallet auth challenge lifetime. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** Challenge message prefix so users can recognize Serller prompts in their wallet. */
export const CHALLENGE_PREFIX = "serller-login:";

/** Posting limits. */
export const POST_TEXT_MAX = 500;
export const COMMENT_TEXT_MAX = 500;
export const BIO_MAX = 160;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

/** Media upload limits. */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
export const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

/** Pagination. */
export const PAGE_SIZE = 20;
export const COMMENTS_PAGE_SIZE = 20;

/** Tipping. */
export const TIP_MIN_STROOPS = 10_000_000n; // 1 XLM minimum
export const TIP_MAX_STROOPS = 10_000_000_000n; // 1000 XLM maximum
export const TIP_MEMO_PREFIX = "SERLLER-TIP:";

/** Rate limits (per-window) — in-memory; see lib/rate-limit.ts. */
export const RATE_LIMITS = {
  authChallenge: { windowMs: 60_000, max: 10 },
  authVerify: { windowMs: 60_000, max: 20 },
  createPost: { windowMs: 60_000, max: 10 },
  tip: { windowMs: 60_000, max: 10 },
  mediaUpload: { windowMs: 3_600_000, max: 30 },
  default: { windowMs: 60_000, max: 120 },
} as const;

/** Testnet funder — funds any target address without a secret key. */
export const FRIENDBOT_URLS = {
  testnet: "https://friendbot.stellar.org",
  futurenet: "https://friendbot-futurenet.stellar.org",
} as const;

/** Stellar network configuration (from env, validated at boot). */
export const STELLAR_NETWORKS = {
  testnet: {
    network: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    friendbotUrl: FRIENDBOT_URLS.testnet,
  },
  mainnet: {
    network: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl: "https://soroban-rpc.stellar.org",
    friendbotUrl: null,
  },
} as const;

export type StellarNetworkName = keyof typeof STELLAR_NETWORKS;
