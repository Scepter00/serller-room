"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hash, Search, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostCard } from "@/components/post-card";
import { EmptyState, ErrorState, FullPageSpinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { ApiPost } from "@/lib/feed";

interface DiscoverData {
  trendingUsers: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    followersCount: number;
  }[];
  trendingHashtags: { tag: string; count: number }[];
  recentPosts: ApiPost[];
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag");
  const [query, setQuery] = useState(tag ?? "");
  const [activeTag, setActiveTag] = useState<string | null>(tag);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [searchPosts, setSearchPosts] = useState<ApiPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void api<DiscoverData>("/api/discover")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchPosts(null);
        setActiveTag(null);
        return;
      }
      setLoading(true);
      try {
        const res = await api<{ posts: ApiPost[] }>(
          `/api/search?q=${encodeURIComponent(q.trim())}&type=posts`
        );
        setSearchPosts(res.posts);
        setActiveTag(q.trim().toLowerCase());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (tag) runSearch(tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const visiblePosts = searchPosts ?? data?.recentPosts ?? [];
  const searching = searchPosts !== null;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold">Discover</h1>
        <p className="text-sm text-t2">Trending users, hashtags and posts.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2"
      >
        <Search className="h-4 w-4 text-t3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users, posts, hashtags…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-t3"
        />
        <button type="submit" className="text-sm font-semibold text-brand">
          Search
        </button>
      </form>

      {loading && !data ? (
        <FullPageSpinner />
      ) : error ? (
        <ErrorState message={error} retry={() => location.reload()} />
      ) : (
        <>
          {!searching && data && (
            <>
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-t3">
                  <TrendingUp className="h-4 w-4" /> Trending users
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.trendingUsers.map((u) => (
                    <Link
                      key={u.id}
                      href={u.username ? `/profile/${u.username}` : "#"}
                      className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
                    >
                      <Avatar
                        name={u.displayName ?? u.username ?? "u"}
                        seed={u.username ?? u.id}
                        src={u.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {u.displayName ?? u.username}
                        </p>
                        <p className="truncate text-xs text-t3">
                          {u.username ? `@${u.username}` : ""} · {u.followersCount} followers
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-t3">
                  <Hash className="h-4 w-4" /> Trending hashtags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.trendingHashtags.map((h) => (
                    <button
                      key={h.tag}
                      type="button"
                      onClick={() => {
                        setActiveTag(h.tag);
                        void runSearch(h.tag);
                      }}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:border-brand/60"
                    >
                      #{h.tag} <span className="text-t3">· {h.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-t3">
              {activeTag ? `Posts tagged #${activeTag}` : "Trending posts"}
            </h2>
            {visiblePosts.length === 0 ? (
              <EmptyState title="No posts found" description="Try a different search." />
            ) : (
              <div className="space-y-4">
                {visiblePosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
