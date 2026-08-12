# Serller — User Flows

> Status: Complete (Phase 1)

## Flow 1 — First visit + wallet auth (core)

```
Landing page
  → "Connect Wallet" (Freighter)
  → Serller requests access to public key only (requestAccess)
  → Server issues cryptographic challenge (nonce, 5 min expiry)
  → Wallet signs challenge (SEP-53 signMessage)
  → Server verifies signature + nonce (single-use)
  → JWT session cookie established
  → If new wallet: prompt to claim a username → profile created
  → If returning: redirect to /feed
```

Failure paths: Freighter not installed → install prompt; signature invalid → error, no session;
challenge expired → re-issue.

## Flow 2 — Create a post (text / image / link)

```
/feed composer
  → Type text (≤ 500 chars), attach image (≤ 5 MB), paste link
  → Image uploaded to IPFS via signed URL → CID returned
  → POST /api/posts (text, mediaCid, link, notarize?: bool)
  → [if notarize] Soroban notary contract called → tx hash
  → Post appears in feed; notification to mention targets
```

## Flow 3 — Like / comment / reply

```
Post card → ❤ like → optimistic UI → POST /api/posts/:id/like
  → notification to author
Post card → 💬 comment (or reply on a comment)
  → POST /api/posts/:id/comments
  → notification to author / parent author
```

## Flow 4 — Follow / discover / search

```
Profile page → Follow button → POST /api/users/:username/follow
  → notification to target
/feed tabs: Following | For You | Latest | Trending
/discover: trending users, hashtags, recent posts
/search?q= → users + posts + hashtags
```

## Flow 5 — Tip a creator (XLM, Testnet first)

```
Post card → "Tip" → dialog: amount (XLM), shows recipient + address
  → Server resolves recipient address from username (never trusts client address)
  → Server builds payment transaction (XLM, memo "SERLLER-TIP:<postId>")
  → Client signs with Freighter
  → Client submits signed XDR; server re-verifies dest/amount/asset before forwarding
  → Horizon confirmation → success state → explorer link
  → Transaction recorded in DB; tip notification to recipient; indexer attributes event
```

Error states: user cancels; insufficient balance; invalid recipient; tx failed (bad seq /
low reserve); network failure; timeout; duplicate submission (idempotent by tx hash).

## Flow 6 — Notifications

```
Inbox bell → follow, like, comment, reply, mention, tip notifications
  → click → navigate to target (post, profile)
  → unread badge; mark-read on open
```

## Flow 7 — Wallet hub

```
/wallet → connected address, copy button, network indicator (TESTNET badge)
  → "Fund with Friendbot" (Testnet only) → 10,000 test XLM to own address
  → tip history (from DB + on-chain tx hash links)
  → disconnect
```

## Flow 8 — Moderation

```
Report (user or post) → POST /api/reports → reviewed by moderator flag
Block user → hides their posts/comments from your feeds
Mute user → no notifications from them; content visible but collapsed
```

## Flow 9 — Android (Capacitor)

```
Install APK → same web app in WebView shell
  → splash → deep link (network.serller.app/...) → wallet opens in external Freighter
  → back navigation, keyboard handling, image upload via system picker
```

## Flow 10 — Indexer lifecycle (internal)

```
Indexer starts → loads checkpoint (last processed ledger/op) from DB
  → tails Horizon payments + contract events
  → dedupe by unique (tx_hash, op_index) constraint
  → on crash/restart → resumes from checkpoint, no duplicates
```
