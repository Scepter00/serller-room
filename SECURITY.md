# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` (development) | ✅ |
| `v0.1.0` (planned) | ✅ after release |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

- Report privately to the maintainers by opening a [security advisory](https://github.com/Scepter00/serller-room/security/advisories/new)
  or by emailing the repository maintainers with the subject `[Serller Security]`.
- Include: affected component, description, steps to reproduce, impact, and (if known) a suggested fix.
- We aim to acknowledge reports within 72 hours and triage within 7 days.

## Design principles (see docs/architecture + Phase 13 review)

- **Private keys never touch Serller.** Users' secret keys are never requested, stored, logged,
  or transmitted. Authentication is signature-based (SEP-53) over a server-issued, single-use
  challenge.
- **The client never builds money-moving transactions.** The server builds tip transactions and
  re-verifies recipient/amount/asset before submission; the wallet only signs.
- **Secrets stay server-side.** JWT session in an httpOnly, SameSite=Lax cookie; Pinata JWT never
  leaves the server.
- **Testnet-first.** Mainnet requires a passed security review.
- **Input validation** everywhere (Zod), parameterized queries (Prisma), file upload validation,
  rate limiting, structured errors.

## Scope

In scope: `app/`, `lib/`, `indexer/`, `contracts/`, authentication, tipping, media uploads,
database access, session handling, and production configuration.

Out of scope: vulnerabilities in third-party dependencies (report upstream), Freighter itself
(report to the Stellar Development Foundation), or the Stellar network.
