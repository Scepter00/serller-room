# Serller — Storage Architecture

> Status: Complete (Phase 2)

## 1. Decision

- **Media → IPFS, pinned via Pinata (Files API v3).**
- Retrieval through a dedicated gateway (`IPFS_GATEWAY_URL`, e.g. `https://<sub>.mypinata.cloud`)
  or public gateways (`ipfs.io`, `dweb.link`).
- **No media blobs on-chain.** The database stores the CID; posts reference the CID.
- Local development fallback (clearly marked `DEV-MOCK`): files stored under `public/uploads/`
  served by Next.js — **only active when `STORAGE_DRIVER=local`**; production must use `pinata`.

## 2. Media architecture

```
User ──► Next.js API (auth, validate) ──► Pinata signed upload URL / server upload
                                             │
                                             ▼
                                          IPFS node
                                             │  pin
                                             ▼
                                          CID (content-addressed)
                                             │
                                             ▼
                                  media row + post.mediaCid  (PostgreSQL)
                                             │
                                             ▼
                              <img src="https://<gateway>/ipfs/<CID>">
```

## 3. Upload security (validation matrix)

| Check | Rule |
|---|---|
| File type | MIME allowlist: `image/jpeg, png, gif, webp, avif` |
| Extension | must match MIME |
| Size | ≤ 5 MB |
| Content sniff | first bytes checked for magic numbers (no HTML/script) |
| Auth | upload requires verified session |
| Rate limit | 30 uploads / hour / user |
| Server-side re-validation | client-provided metadata never trusted |

Rejected files → 400 with structured error.

## 4. Storage driver interface (`lib/storage.ts`)

```ts
interface StorageDriver {
  put(file: { name; type; size; buffer }): Promise<{ cid; url }>;
}
```
- `PinataDriver` — uses `PINATA_JWT` + `PINATA_GROUP_ID?`, uploads via Files API v3,
  returns `{ cid, url: gateway + "/ipfs/" + cid }`.
- `LocalDriver` — **DEV ONLY**: writes to `public/uploads/<uuid>.<ext>`, returns local URL,
  logs a warning that production requires Pinata. Marked as a development mock per Rule 2 and
  replaced automatically when `STORAGE_DRIVER=pinata`.

## 5. Gateway & availability

- CIDs are content-addressed: identical files dedupe.
- Pinning guarantees persistence on Pinata nodes; public gateways provide fallback resolution.
- `avatarUrl` / media URLs are stored **after** upload so the UI can render from the gateway.
