/**
 * ⚠️ DEMO SEED — clearly marked development mock (Rule 2).
 *
 * Creates demo profiles + posts so the feed is explorable without a wallet.
 * - Demo "wallet addresses" are fake placeholder strings for display only;
 *   they are NOT real Stellar accounts and cannot authenticate or tip.
 * - Real authentication requires an actual Freighter wallet (Phase 5).
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    username: "stellarnova",
    displayName: "Stella Nova",
    bio: "Stellar builder · testnet explorer · tipping the people I love in XLM 🚀",
    wallet: "GDEMO11111111111111111111111111111111111111111111",
  },
  {
    username: "soroban_sam",
    displayName: "Soroban Sam",
    bio: "Writing Rust contracts on Stellar. Content notary = proof of authorship.",
    wallet: "GDEMO22222222222222222222222222222222222222222222",
  },
  {
    username: "lumen_lisa",
    displayName: "Lumen Lisa",
    bio: "XLM maxi. Artist. My art lives on IPFS, my tips live on-chain.",
    wallet: "GDEMO33333333333333333333333333333333333333333333",
  },
  {
    username: "testnet_ted",
    displayName: "Testnet Ted",
    bio: "Funding everything with Friendbot since 2026.",
    wallet: "GDEMO44444444444444444444444444444444444444444444",
  },
];

const DEMO_POSTS = [
  ["stellarnova", "gm from the Stellar ecosystem ☀️ Who else is excited about Soroban contracts on Testnet? #stellar #soroban"],
  ["soroban_sam", "Just shipped the Serller content notary contract — register a hash of your post on-chain and prove authorship forever. #builders"],
  ["lumen_lisa", "New artwork uploaded via IPFS 🎨 every like is appreciated, every tip is a masterpiece. #nft #art"],
  ["testnet_ted", "Pro tip: you can fund ANY Stellar testnet address with Friendbot. No secret keys required. #testnet"],
  ["stellarnova", "Tipping feels magical when it settles in ~4 seconds. Thanks for the XLM, everyone ❤️ #stellar"],
  ["soroban_sam", "On-chain ≠ everything. Feed data lives in Postgres, payments live on Stellar. Use each tool where it shines. #web3 #architecture"],
  ["lumen_lisa", "How it works: image → IPFS → CID → post → tip → explorer link. The creator economy, but fair. #creators"],
  ["testnet_ted", "Reminder: Stellar Testnet resets a few times a year. Contracts get wiped, we redeploy. That's the deal. #devops"],
];

function hash(input) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function main() {
  console.log("Seeding demo data (DEV MOCK — fake wallet addresses, not real accounts)…");

  const created = [];
  for (const u of DEMO_USERS) {
    let user = await prisma.user.findUnique({ where: { walletAddress: u.wallet } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress: u.wallet } });
    }
    let profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          username: u.username,
          displayName: u.displayName,
          bio: u.bio,
        },
      });
    } else {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: { username: u.username, displayName: u.displayName, bio: u.bio },
      });
    }
    created.push(profile);
  }

  const byName = new Map(created.map((p) => [p.username, p]));

  // Demo follows
  const followPairs = [
    ["testnet_ted", "stellarnova"],
    ["lumen_lisa", "stellarnova"],
    ["soroban_sam", "stellarnova"],
    ["stellarnova", "soroban_sam"],
    ["testnet_ted", "lumen_lisa"],
  ];
  for (const [follower, following] of followPairs) {
    const a = byName.get(follower);
    const b = byName.get(following);
    if (!a || !b) continue;
    await prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: a.id, followingId: b.id },
      },
      create: { followerId: a.id, followingId: b.id },
      update: {},
    });
  }

  // Demo posts (idempotent by contentHash)
  for (const [username, text] of DEMO_POSTS) {
    const author = byName.get(username);
    if (!author) continue;
    const contentHash = hash({ author: username, text, t: "demo-seed-v1" });
    const existing = await prisma.post.findFirst({ where: { contentHash } });
    if (existing) continue;
    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        text,
        contentHash,
        hashtags: {
          create: [...text.matchAll(/#([a-zA-Z0-9_]+)/g)].map((m) => ({
            tag: m[1].toLowerCase(),
          })),
        },
      },
    });

    // A few likes to make trending interesting
    const likers = created.filter((p) => p.id !== author.id).slice(0, 2);
    for (const liker of likers) {
      await prisma.like.upsert({
        where: { userId_postId: { userId: liker.id, postId: post.id } },
        create: { userId: liker.id, postId: post.id },
        update: {},
      });
    }
  }

  console.log(`✓ Seeded ${created.length} demo profiles + ${DEMO_POSTS.length} demo posts.`);
  console.log("  ⚠ These are DEV MOCKS. Real users authenticate with Freighter wallets.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
