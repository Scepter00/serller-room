# Serller — API Architecture

> Status: Complete (Phase 2)

## 1. Conventions

- Base URL: `/api` (Next.js App Router route handlers).
- JSON everywhere. Errors: `{ "error": { "code": "...", "message": "..." } }`.
- Auth: `Authorization` handled via httpOnly cookie `serller_session` (JWT).
- Pagination: `?cursor=<id>&limit=20` (keyset) with `nextCursor` in response.
- Validation: Zod schemas in `lib/validation.ts`; 400 on failure.
- Rate limiting: token-bucket in `lib/rate-limit.ts` (auth-heavy routes stricter).

## 2. Endpoints

### Auth (Phase 5)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/challenge` | — | Body `{ publicKey }` → `{ nonce, message, expiresAt }` (message = `serller-login:<nonce>`) |
| POST | `/api/auth/verify` | — | Body `{ publicKey, nonce, signature }` → verifies SEP-53 sig, sets JWT cookie, returns session + profile |
| GET | `/api/auth/me` | ✔ | Current user + profile |
| POST | `/api/auth/logout` | ✔ | Clears session |

### Profiles & users (Phase 6/7)
| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | `/api/profile` | ✔ | Update displayName, bio, avatarCid |
| GET | `/api/users?q=&cursor=` | — | User search |
| GET | `/api/users/[username]` | — | Public profile + stats |
| POST | `/api/users/[username]/follow` | ✔ | Follow |
| DELETE | `/api/users/[username]/follow` | ✔ | Unfollow |
| GET | `/api/users/[username]/posts` | — | Paginated posts |

### Posts (Phase 6/7)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/posts` | ✔ | Create post (text/media/link, optional notarize) |
| GET | `/api/posts?feed=following\|forYou\|latest\|trending&cursor=` | partial | Feed (following/forYou need auth) |
| GET | `/api/posts/[id]` | — | Post + comments |
| PATCH | `/api/posts/[id]` | ✔ owner | Edit text (notarized posts immutable → 409) |
| DELETE | `/api/posts/[id]` | ✔ owner | Delete (soft) |
| POST | `/api/posts/[id]/like` | ✔ | Like |
| DELETE | `/api/posts/[id]/like` | ✔ | Unlike |
| POST | `/api/posts/[id]/comments` | ✔ | Comment / reply (`parentId`) |
| GET | `/api/posts/[id]/comments` | — | Paginated comments |

### Social (Phase 7/12)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications?cursor=` | ✔ | Own notifications; marks read |
| GET | `/api/search?q=&type=users\|posts\|hashtags` | — | Search |
| GET | `/api/discover` | — | Trending users/hashtags/posts |
| POST | `/api/reports` | ✔ | Report user/post |
| POST | `/api/users/[username]/block` | ✔ | Block |
| POST | `/api/users/[username]/mute` | ✔ | Mute |

### Media (Phase 8)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/media` | ✔ | Server upload → IPFS (or dev fallback), returns `{ cid, url }` |

### Payments (Phase 10)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/transactions/tip` | ✔ | Body `{ username, amount, postId }` → server builds payment XDR → `{ unsignedXdr, recipient, amount, buildId }` |
| POST | `/api/transactions/submit` | ✔ | Body `{ buildId, signedXdr }` → re-verify dest/amount/asset → submit → `{ txHash, status, explorerUrl }` |
| GET | `/api/transactions?cursor=` | ✔ | Own tip history |

### Contract (Phase 9)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/contract/notary` | — | Contract status (id, network, wasm hash) |
| POST | `/api/contract/notary/verify` | — | Body `{ contentHash }` → on-chain record (read) |

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | DB + network status |

## 3. Auth model

- Challenge: DB row `auth_challenges` (nonce, publicKey, 5-min expiry, single-use).
- Verify: `Keypair.fromPublicKey(pub).verifyMessage(message, sig)` (SEP-53) → JWT (HS256, 7d)
  in httpOnly cookie. Wallet claim is only accepted after a valid signature (Phase 5).

## 4. Moderation visibility

- Blocked users' posts/comments are filtered from the blocking user's feed and notifications.
- Muted users' notifications suppressed.
- `status: removed` posts return 404 to non-moderators.

## 5. Idempotency

- Likes/follows: unique constraints → upsert semantics.
- Tip submit: `buildId` + tx hash uniqueness → duplicate submission returns the original result.
