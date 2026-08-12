# Serller — Authentication Architecture

> Status: Complete (Phase 2)

## 1. Principles

- **Identity = Stellar public key.** Serller authenticates *wallets*, not passwords.
- **Never trust a bare address.** A wallet only authenticates by producing a valid signature over a
  challenge the server issued (Rule 3 + Phase 5 acceptance criteria).
- **Private keys never leave the wallet.** No secret key is ever requested, stored, logged, or
  transmitted (Rule 3).

## 2. Flow

```
1. Client (Freighter)  requestAccess()            → publicKey G...
2. Client → POST /api/auth/challenge { publicKey }
   Server:
     - validates publicKey format (StrKey G/C)
     - rate-limits per address
     - creates auth_challenges row: nonce = crypto.randomUUID(),
       message = "serller-login:" + nonce, expiresAt = now + 5 min
     - returns { nonce, message, expiresAt }
3. Client  freighter.signMessage(message)          → signature (SEP-53 envelope)
4. Client → POST /api/auth/verify { publicKey, nonce, signature }
   Server:
     - loads challenge row (must exist, unexpired, unused, matching publicKey)
     - verifies: Keypair.fromPublicKey(publicKey).verifyMessage(message, signature)
     - marks challenge used (single-use → replay-resistant)
     - upserts user by walletAddress (creates placeholder profile if new)
     - signs JWT (HS256, jose) with AUTH_SECRET: { sub: userId }, 7d expiry
     - sets httpOnly cookie serller_session (SameSite=Lax; Secure in prod)
     - returns { user, profile, isNewUser }
```

## 3. Replay & abuse protection

- Challenges are single-use (DB `used` flag) and expire in 5 minutes.
- `nonce` must match a challenge row bound to the claimed publicKey.
- Rate limiting on challenge (e.g. 10/min/address) and verify (20/min/IP).
- JWT `sub` = user id; server always re-loads user from DB per request.

## 4. Sessions

- JWT stored in an **httpOnly, SameSite=Lax cookie** — immune to XSS exfiltration via JS.
- CSRF: SameSite=Lax + routes require a custom header (`x-serller-csrf: 1`) for state-changing calls.
- Expiry: 7 days; logout deletes the cookie.
- No secret material in localStorage (Rule 3).

## 5. Wallet ↔ username separation

- A wallet address is the *identity*; a username is a *handle* the user claims (Phase 5/6).
- One wallet → one profile; usernames unique; migration of username to a new wallet is a future feature.
- Profile rows are created automatically on first verified login with a pending `username` claim
  (POST /api/profile to set it).

## 6. Signature verification details

- Freighter `signMessage` implements SEP-53 ("signed message" envelope).
- Verify against `@stellar/stellar-sdk` `Keypair.verifyMessage` if available, else legacy
  `Keypair.verify(Buffer.from(message), Buffer.from(sig, "base64"))`. The chosen path is locked in
  `lib/stellar/verify.ts` and covered by unit tests that sign with a real `Keypair` (Phase 5/14).
- All verification wrapped in try/catch; any failure = 401 with a structured error.

## 7. Threat model

| Threat | Control |
|---|---|
| Replay captured signature | Single-use nonce + expiry |
| Stolen cookie | httpOnly + SameSite + short TTL; optional rotation |
| Fake wallet claim | Signature verification required |
| Phishing (fake dApp asks to sign) | Challenge message clearly readable in wallet; prefix `serller-login:` |
| Sign-in spam | Rate limiting |
