"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Ban, BellOff, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PostCard } from "@/components/post-card";
import { EmptyState, ErrorState, FullPageSpinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { ApiPost } from "@/lib/feed";

interface ProfileData {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  blocked: boolean;
  blockingMe: boolean;
  muted: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void api<{ profile: ProfileData; posts: ApiPost[] }>(
      `/api/users/${encodeURIComponent(username)}`
    )
      .then((d) => {
        setProfile(d.profile);
        setPosts(d.posts);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(action: "block" | "unblock" | "mute" | "unmute") {
    if (!profile) return;
    try {
      await api(`/api/users/${encodeURIComponent(username)}/${action === "block" || action === "unblock" ? "block" : "mute"}`, {
        method: action === "block" || action === "mute" ? "POST" : "DELETE",
      });
      load();
    } catch {
      /* ignore */
    }
  }

  if (loading && !profile) return <FullPageSpinner />;
  if (error && !profile)
    return (
      <div className="mx-auto max-w-xl p-4">
        <ErrorState message={error} retry={load} />
      </div>
    );
  if (!profile) return null;

  const displayName = profile.displayName ?? profile.username ?? "User";

  return (
    <div className="mx-auto max-w-xl">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <Avatar
            name={displayName}
            seed={profile.username ?? profile.id}
            src={profile.avatarUrl}
            size="xl"
          />
          <div className="flex items-center gap-2">
            {!profile.isSelf && (
              <>
                <button
                  type="button"
                  onClick={() => moderate(profile.muted ? "unmute" : "mute")}
                  aria-label={profile.muted ? "Unmute" : "Mute"}
                  className="rounded-full border border-border bg-surface p-2 text-t2 transition-colors hover:text-t1"
                >
                  <BellOff className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moderate(profile.blocked ? "unblock" : "block")}
                  aria-label={profile.blocked ? "Unblock" : "Block"}
                  className="rounded-full border border-border bg-surface p-2 text-t2 transition-colors hover:text-danger"
                >
                  <Ban className="h-4 w-4" />
                </button>
              </>
            )}
            <FollowButton
              username={profile.username ?? ""}
              initialFollowing={profile.isFollowing}
              isSelf={profile.isSelf}
            />
          </div>
        </div>

        <h1 className="mt-3 text-xl font-bold">{displayName}</h1>
        {profile.username && <p className="text-sm text-t3">@{profile.username}</p>}
        {profile.bio && <p className="mt-2 text-[15px] leading-relaxed">{profile.bio}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-t2">
          <span>
            <b className="text-t1">{profile.postsCount}</b> posts
          </span>
          <span>
            <b className="text-t1">{profile.followersCount}</b> followers
          </span>
          <span>
            <b className="text-t1">{profile.followingCount}</b> following
          </span>
          <span className="flex items-center gap-1 text-t3">
            <CalendarDays className="h-3.5 w-3.5" />
            Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
        </div>

        {profile.blockingMe && (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            This user has blocked you — their content is hidden.
          </p>
        )}
      </div>

      {/* posts */}
      <div className="space-y-4 p-4">
        {posts.length === 0 ? (
          <EmptyState
            title={`${displayName} hasn't posted yet`}
            description="Posts will appear here."
          />
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}
