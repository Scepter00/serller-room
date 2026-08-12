# Serller

Serller is a Stellar focused Web3 social network prototype. It combines a familiar social feed with wallet based identity and a path toward decentralized content, creator tipping, and Soroban powered social primitives.

## Current MVP

- Responsive social feed
- Wallet connection UI with browser wallet detection
- Wallet based profile identity
- Post composer with local persistence
- Likes, comments and follows in the browser
- Stellar Testnet configuration
- Creator tipping transaction flow using native XLM
- Activity and network panels

## Stack

- Next.js 15
- React 19
- TypeScript
- Stellar SDK
- CSS

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The app uses Testnet by default. No private keys are stored by Serller. Transactions are built in the browser and signed by the connected wallet.

## Architecture direction

The current MVP intentionally keeps social state local so the interface is usable without a database. The next production layer can replace the local repository with an indexer/database and move large media to IPFS while retaining wallet ownership and Stellar settlement.

## Security notes

Never place a secret key in `.env.local` or client code. Only public addresses and unsigned transaction data belong in the browser. Always review transaction details in the wallet before signing.
