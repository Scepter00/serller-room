"use client";

import { useEffect, useMemo, useState } from "react";
import { Asset, Networks, Transaction } from "@stellar/stellar-sdk";
import { buildTipTransaction, STELLAR_NETWORK } from "@/lib/stellar";
import { getPosts, savePosts, shortAddress } from "@/lib/storage";
import type { Post } from "@/lib/types";

type WalletApi = { publicKey?: () => Promise<string>; signTransaction?: (xdr: string, opts?: Record<string, unknown>) => Promise<{ signedTxXdr: string }> };

declare global { interface Window { freighter?: WalletApi; } }

export default function Home() {
  const [address, setAddress] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [composer, setComposer] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tipPost, setTipPost] = useState<Post | null>(null);
  const [tipAmount, setTipAmount] = useState("1");
  const [followed, setFollowed] = useState<string[]>([]);

  useEffect(() => setPosts(getPosts()), []);
  useEffect(() => { if (posts.length) savePosts(posts); }, [posts]);

  const visiblePosts = useMemo(() => posts.filter((p) => `${p.displayName} ${p.text}`.toLowerCase().includes(search.toLowerCase())), [posts, search]);

  async function connectWallet() {
    try {
      if (!window.freighter?.publicKey) {
        setStatus("Install or open a compatible Stellar wallet such as Freighter.");
        return;
      }
      const key = await window.freighter.publicKey();
      setAddress(key);
      setStatus("Wallet connected");
    } catch { setStatus("Wallet connection was cancelled."); }
  }

  function publish() {
    if (!composer.trim()) return;
    const author = address ? shortAddress(address) : "Guest";
    setPosts((current) => [{ id: crypto.randomUUID(), author: address || "guest", displayName: author, text: composer.trim(), createdAt: Date.now(), likes: 0, comments: [] }, ...current]);
    setComposer("");
    setStatus("Post published locally. Decentralized storage comes next.");
  }

  function like(id: string) { setPosts((current) => current.map((p) => p.id === id ? { ...p, likes: p.likes + 1 } : p)); }

  async function tip(post: Post) {
    if (!address) { setStatus("Connect your wallet before tipping."); return; }
    try {
      setStatus("Preparing transaction...");
      const destination = post.author.length === 56 && post.author.startsWith("G") ? post.author : "GBZX7IYB7Z2YQXQJ2V4Y7Q5R2S3D6E6Q7N5P3Q4R5S6T7U8V9W0X";
      const tx = await buildTipTransaction(address, destination, tipAmount);
      if (!window.freighter?.signTransaction) throw new Error("Wallet signing is unavailable.");
      const signed = await window.freighter.signTransaction(tx.toXDR(), { networkPassphrase: STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET });
      const parsed = TransactionBuilder.fromXDR(signed.signedTxXdr, STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET) as Transaction;
      setStatus(`Transaction signed. Submit ${parsed.hash().slice(0, 8)}… through your wallet or Horizon client.`);
      setTipPost(null);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to create tip transaction."); }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">S</span> serller</div><nav><a className="active" href="#feed">Feed</a><a href="#discover">Discover</a><a href="#profile">Profile</a></nav><button className="wallet" onClick={connectWallet}>{address ? shortAddress(address) : "Connect wallet"}</button></header>

    <section className="hero"><div><p className="eyebrow">STELLAR SOCIAL PROTOCOL</p><h1>Your social graph.<br /><em>Owned by you.</em></h1><p className="hero-copy">A social space where identity, relationships and creator payments can move with your wallet.</p><div className="hero-actions"><button className="primary" onClick={connectWallet}>Start with Stellar</button><a className="secondary" href="#feed">Explore the feed ↗</a></div></div><div className="orbital"><div className="orbit orbit-one"><span>✦</span></div><div className="orbit orbit-two"><span>◈</span></div><div className="core">S</div></div></section>

    {status && <div className="notice">{status}</div>}
    <section className="content" id="feed"><div className="feed-column"><div className="section-heading"><div><p className="eyebrow">THE TIMELINE</p><h2>Latest from your network</h2></div><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts" /></div>
      <article className="composer"><div className="avatar">{address ? "S" : "?"}</div><div className="composer-body"><textarea value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Share something with the network..." /><div className="composer-footer"><span>◌ IPFS ready</span><button className="post-button" disabled={!composer.trim()} onClick={publish}>Publish</button></div></div></article>
      {visiblePosts.map((post) => <article className="post" key={post.id}><div className="avatar small">{post.displayName[0]}</div><div className="post-body"><div className="post-meta"><strong>{post.displayName}</strong><span>{new Date(post.createdAt).toLocaleString()}</span><button>•••</button></div><p>{post.text}</p><div className="post-actions"><button onClick={() => like(post.id)}>♡ {post.likes}</button><button>◯ {post.comments.length}</button><button>↗ Share</button><button className="tip" onClick={() => setTipPost(post)}>✦ Tip</button><button onClick={() => setFollowed((f) => f.includes(post.author) ? f.filter((x) => x !== post.author) : [...f, post.author])}>{followed.includes(post.author) ? "Following" : "Follow"}</button></div></div></article>)}
    </div><aside><div className="card protocol"><p className="eyebrow">NETWORK</p><h3>Built on Stellar</h3><p>Fast settlement and low fees for a social economy.</p><div className="stat"><span>Network</span><strong>{STELLAR_NETWORK}</strong></div><div className="stat"><span>Identity</span><strong>Wallet based</strong></div></div><div className="card"><p className="eyebrow">TRENDING</p><div className="trend"><span>#Soroban</span><small>1,284 posts</small></div><div className="trend"><span>#Stellar</span><small>956 posts</small></div><div className="trend"><span>#Web3</span><small>731 posts</small></div></div></aside></section>

    {tipPost && <div className="modal-backdrop" onClick={() => setTipPost(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><p className="eyebrow">CREATOR TIP</p><h3>Tip {tipPost.displayName}</h3><p>Send native XLM from your connected Stellar wallet.</p><input className="amount" value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} inputMode="decimal" /><div className="modal-actions"><button className="secondary-button" onClick={() => setTipPost(null)}>Cancel</button><button className="primary" onClick={() => tip(tipPost)}>Sign tip</button></div></div></div>}
    <footer><span>serller · social, owned by you</span><span>Stellar {STELLAR_NETWORK} · Open source</span></footer>
  </main>;
}
