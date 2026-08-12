"use client";

import { useState } from "react";

const posts = [
  {
    author: "0x7A...91F2",
    time: "12 min ago",
    text: "Building on Stellar feels different when the product is designed around the user owning their identity.",
    likes: 128,
    comments: 24,
  },
  {
    author: "Gwen ✦",
    time: "1 hr ago",
    text: "Just shipped my first Soroban contract. Small contract, huge feeling. 🚀",
    likes: 84,
    comments: 12,
  },
];

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  const [composer, setComposer] = useState("");

  const toggleLike = (index: number) => {
    setLiked((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]
    );
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span> serller</div>
        <nav><a className="active" href="#feed">Feed</a><a href="#explore">Explore</a><a href="#network">Network</a></nav>
        <button className="wallet" onClick={() => setConnected(!connected)}>
          {connected ? "Connected · G...91F2" : "Connect wallet"}
        </button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">STELLAR SOCIAL PROTOCOL</p>
          <h1>Your social graph.<br /><em>Owned by you.</em></h1>
          <p className="hero-copy">Serller is a social space where your identity, relationships and creator economy can move with your wallet.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setConnected(true)}>Start with Stellar</button>
            <a className="secondary" href="#feed">Explore the feed <span>↗</span></a>
          </div>
        </div>
        <div className="orbital" aria-hidden="true">
          <div className="orbit orbit-one"><span>✦</span></div>
          <div className="orbit orbit-two"><span>◈</span></div>
          <div className="core">S</div>
        </div>
      </section>

      <section className="content" id="feed">
        <div className="feed-column">
          <div className="section-heading"><div><p className="eyebrow">THE TIMELINE</p><h2>Latest from your network</h2></div><button className="filter">For you⌄</button></div>

          <article className="composer">
            <div className="avatar">S</div>
            <div className="composer-body">
              <textarea value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Share something with the network..." />
              <div className="composer-footer"><span>◌ IPFS ready</span><button className="post-button" disabled={!composer.trim()} onClick={() => setComposer("")}>Publish</button></div>
            </div>
          </article>

          {posts.map((post, index) => {
            const isLiked = liked.includes(index);
            return <article className="post" key={post.author}>
              <div className="avatar small">{index === 0 ? "7" : "G"}</div>
              <div className="post-body">
                <div className="post-meta"><strong>{post.author}</strong><span>{post.time}</span><button>•••</button></div>
                <p>{post.text}</p>
                <div className="post-actions">
                  <button className={isLiked ? "liked" : ""} onClick={() => toggleLike(index)}>♡ {post.likes + (isLiked ? 1 : 0)}</button>
                  <button>◯ {post.comments}</button>
                  <button>↗ Share</button>
                  <button className="tip">✦ Tip</button>
                </div>
              </div>
            </article>;
          })}
        </div>

        <aside>
          <div className="card protocol"><p className="eyebrow">NETWORK</p><h3>Built on Stellar</h3><p>Fast settlement, low fees and an open foundation for social ownership.</p><div className="stat"><span>Network</span><strong>Testnet</strong></div><div className="stat"><span>Identity</span><strong>Wallet based</strong></div></div>
          <div className="card"><p className="eyebrow">TRENDING</p><div className="trend"><span>#Soroban</span><small>1,284 posts</small></div><div className="trend"><span>#Stellar</span><small>956 posts</small></div><div className="trend"><span>#Web3</span><small>731 posts</small></div></div>
        </aside>
      </section>

      <footer><span>serller · social, owned by you</span><span>Stellar Testnet · Open source</span></footer>
    </main>
  );
}
