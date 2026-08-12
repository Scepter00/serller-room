"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Users } from "lucide-react";
import { Composer } from "@/components/composer";
import { PostCard } from "@/components/post-card";
import { EmptyState, ErrorState, FullPageSpinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { ApiPost } from "@/lib/feed";
import { cn } from "@/lib/utils";

type FeedTab = "following" | "forYou" | "latest" | "trending";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "following", label: "Following" },
  { id: "forYou", label: "For You" },
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
];

export default function FeedPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <FeedContent />
    </Suspense>
  );
}

function FeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("feed") as FeedTab) || "forYou";
  const compose = searchParams.get("compose") === "1";

  const [tab, setTab] = useState<FeedTab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "forYou"
  );
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (cursor?: string) => {
      try {
        const params = new URLSearchParams({ feed: tab });
        if (cursor) params.set("cursor", cursor);
        const data = await api<{ posts: ApiPost[]; nextCursor: string | null }>(
          `/api/posts?${params}`
        );
        if (cursor) {
          setPosts((prev) => [...prev, ...data.posts]);
        } else {
          setPosts(data.posts);
        }
        setNextCursor(data.nextCursor);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setNextCursor(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (compose) {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [compose]);

  function switchTab(next: FeedTab) {
    setTab(next);
    router.replace(`/feed?feed=${next}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-xl px-0 md:px-4">
      {/* sticky feed header */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur md:top-0 lg:top-0">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={cn(
                "flex-1 border-b-2 py-3 text-sm font-semibold transition-colors",
                tab === t.id
                  ? "border-brand text-t1"
                  : "border-transparent text-t3 hover:text-t2"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div ref={composerRef} className="scroll-mt-16">
          <Composer
            onCreated={() => {
              void load();
            }}
          />
        </div>

        {loading ? (
          <FullPageSpinner />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={tab === "following" ? <Users className="h-8 w-8" /> : <Compass className="h-8 w-8" />}
            title={tab === "following" ? "Nothing here yet" : "No posts yet"}
            description={
              tab === "following"
                ? "Follow some creators to fill this feed."
                : "Be the first to post something on Stellar."
            }
          />
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {nextCursor && (
              <div className="flex justify-center pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setLoadingMore(true);
                    void load(nextCursor);
                  }}
                  disabled={loadingMore}
                  className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-t2 transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
