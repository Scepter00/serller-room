# Serller — Database Architecture

> Status: Complete (Phase 2)

## 1. Engine

- **Production:** PostgreSQL 15+.
- **Local dev/tests:** SQLite via Prisma's env-driven provider (`DATABASE_PROVIDER=sqlite`).
- **ORM:** Prisma (schema in `prisma/schema.prisma`).

## 2. Entities

```
User (wallet) 1──1 Profile
Profile       1──N Post
Profile       1──N Comment
Profile       1──N Follow (followerId, followingId)      [unique pair]
Profile       1──N Like    (userId, postId)              [unique pair]
Post          1──N Comment
Post          1──N Like
Post          1──1 Media (optional)  →  stores IPFS CID + metadata
Profile       1──N Notification (recipientId)
Profile       1──N Report (reporterId)
Profile       1──N Block (blockerId, blockedId)
Profile       1──N Mute  (muterId, mutedId)
Post          1──N Transaction (tip)  →  links XLM payment
AuthChallenge (nonce, publicKey, expiresAt)  ← issued during login
BlockchainEvent (txHash, opIndex, type, data) ← written by indexer [unique(txHash, opIndex)]
IndexerCheckpoint (id=1, cursor)              ← single row
```

## 3. Table details (key columns)

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `walletAddress` (unique), `createdAt` | identity = Stellar pubkey |
| `profiles` | `id`, `userId`, `username` (unique), `displayName`, `bio`, `avatarCid`, `avatarUrl`, `moderationStatus`, `createdAt` | wallet and username are conceptually separate (Phase 5) |
| `posts` | `id`, `authorId`, `text`, `link`, `mediaCid`, `notarized` (bool), `notaryTxHash`, `contentHash`, `status` (active/removed), `createdAt`, `updatedAt` | hashtags extracted into `PostHashtag` |
| `post_hashtags` | `postId`, `tag` | indexed for discovery |
| `comments` | `id`, `postId`, `authorId`, `parentId` (nullable → reply), `text`, `status`, `createdAt` | |
| `likes` | `userId`, `postId`, `createdAt` | unique(userId, postId) |
| `follows` | `followerId`, `followingId`, `createdAt` | unique pair, no self-follow |
| `notifications` | `id`, `recipientId`, `actorId`, `type` (follow/like/comment/reply/mention/tip), `postId?`, `read`, `createdAt` | |
| `media` | `id`, `uploaderId`, `cid` (unique), `mimeType`, `sizeBytes`, `originalName`, `createdAt` | |
| `transactions` | `id`, `txHash` (unique), `fromAddress`, `toAddress`, `amount`, `asset` (XLM), `postId?`, `memo`, `status` (pending/confirmed/failed), `confirmations`, `ledger?`, `createdAt` | tip record |
| `reports` | `id`, `reporterId`, `targetType` (user/post), `targetId`, `reason`, `status` (open/reviewed/actioned), `createdAt` | |
| `blocks` / `mutes` | `blockerId`, `blockedId` | unique pair |
| `auth_challenges` | `id`, `publicKey`, `nonce` (unique), `expiresAt`, `used` (bool) | single-use |
| `blockchain_events` | `id`, `txHash`, `opIndex`, `type`, `data` (JSON), `processedAt` | unique(txHash, opIndex) |
| `indexer_checkpoints` | `id` (=1), `cursor`, `updatedAt` | |

## 4. Conventions

- `camelCase` fields, Prisma-managed `createdAt`/`updatedAt` where useful.
- Unique constraints are the source of idempotency (likes, follows, tips, events).
- Soft-delete / moderation flag (`status`) instead of destructive deletes for posts/comments.
- Foreign keys with `onDelete: Cascade` only where data is truly disposable (likes on post delete).

## 5. Migration strategy

- Local: `prisma migrate dev` (SQLite).
- Production: `prisma migrate deploy` against Postgres (migrations committed for postgres),
  or `prisma db push` during pre-1.0 iteration (documented).
