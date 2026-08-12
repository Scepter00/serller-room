# Contributing to Serller

Thanks for helping build Serller! Please read this guide and the
[Architecture docs](docs/architecture/system-architecture.md) before contributing.

## Ground rules (non-negotiable)

1. **Never handle private keys.** No code may request, store, log, or transmit secret keys.
   Wallets sign; we verify. (Rule 3)
2. **No fake Web3.** No simulated wallet connections, signatures, transactions, or confirmations.
   Development mocks must be clearly marked and removed before a phase is complete. (Rule 2)
3. **Testnet first.** No mainnet code paths without a completed security review. (Rule 5)
4. **Blockchain where it makes sense.** Most social data lives in PostgreSQL. (Rule 4)

## Development workflow

1. Check `docs/roadmap.md` for the current phase and task.
2. Create a branch: `git checkout -b feat/<slug>`.
3. Implement the smallest logical piece.
4. Run checks:
   ```bash
   npm run lint && npm run typecheck && npm test
   ```
5. Manually test the feature in the UI.
6. Consider security implications (see `docs/security/security-review.md`).
7. Commit with a **conventional commit** message:
   ```
   feat(wallet): add stellar wallet connection
   fix(auth): validate wallet signatures
   test(posts): add post integration tests
   docs(deployment): document production setup
   ```
8. Open a pull request against `main`. CI runs lint, typecheck, tests and build.

## Committing

- Use logical, focused commits. Do **not** use `git add .` after initial setup — stage specific files.
- Examples: `feat(posts): add post creation`, `fix(tipping): verify recipient address server-side`.

## Testing

- Unit tests: `tests/unit/` (Vitest) — pure logic, validation, wallet signature verification.
- Integration tests: `tests/integration/` (Vitest + SQLite DB) — auth, API, social graph.
- Contract tests: `contracts/content-notary` — `cargo test`.
- E2E: `tests/e2e/` (Playwright).

## Docs

Every major architectural decision must be documented in `docs/` (Rule 8). Update the relevant
doc when you change behavior.

## Security

Found a vulnerability? Do **not** open a public issue. Follow `SECURITY.md`.

## License

By contributing you agree that your contributions are licensed under the MIT License.
