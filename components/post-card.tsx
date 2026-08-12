"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Coins, Heart, MessageCircle, ShieldCheck, Share2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RichText } from "@/components/richtext";
import { TipDialog } from "@/components/tip-dialog";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { cn, fullDate, timeAgo } from "@/lib/utils";
import type { ApiPost } from "@/lib/feed";

export function PostCard({ post }: { post: ApiPost }) {
  const { user } = useSession();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [tipOpen, setTipOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await api(next ? `/api/posts/${post.id}/like` : `/api/posts/${post.id}/like`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <article
      className="card-hover animate-rise-in rounded-2xl border border-border bg-surface p-4"
      aria-label={`Post by ${post.author.displayName ?? post.author.username ?? "unknown"}`}
    >
      <div className="flex gap-3">
        <Link
          href={
            post.author.username ? `/profile/${post.author.username}` : "#"
          }
        >
          <Avatar
            name={post.author.displayName ?? post.author.username ?? "u"}
            seed={post.author.username ?? post.id}
            src={post.author.avatarUrl}
            size="md"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={
                post.author.username ? `/profile/${post.author.username}` : "#"
              }
              className="font-semibold hover:underline"
            >
              {post.author.displayName ?? post.author.username ?? "Anonymous"}
            </Link>
            {post.author.username && (
              <span className="text-sm text-t3">@{post.author.username}</span>
            )}
            <span className="text-sm text-t3">·</span>
            <time
              className="text-sm text-t3"
              dateTime={post.createdAt}
              title={fullDate(post.createdAt)}
            >
              {timeAgo(post.createdAt)}
            </time>
            {post.notarized && (
              <span
                title="Content notarized on the Stellar network"
                className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success"
              >
                <ShieldCheck className="h-3 w-3" />
                Notarized
              </span>
            )}
          </div>

          <div className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            <RichText text={post.text ?? ""} />
          </div>

          {post.mediaUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <Image
                src={post.mediaUrl}
                alt="Post image"
                width={800}
                height={600}
                className="max-h-[420px] w-full object-cover"
                unoptimized={post.mediaUrl.startsWith("/") || post.mediaUrl.includes("ipfs")}
              />
            </div>
          )}

          {post.link && (
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-brand-2 hover:underline"
            >
              <span className="truncate">{post.link}</span>
            </a>
          )}

          {/* actions */}
          <div className="mt-3 flex items-center gap-1 text-t3">
            <button
              type="button"
              onClick={toggleLike}
              disabled={!user}
              aria-label={liked ? "Unlike" : "Like"}
              className={cn(
                "group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-danger/10",
                liked ? "text-danger" : "hover:text-danger",
                !user && "cursor-not-allowed opacity-60"
              )}
            >
              <Heart
                className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", liked && "fill-current")}
              />
              {likeCount}
            </button>

            <Link
              href={`/post/${post.id}`}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-brand/10 hover:text-brand"
            >
              <MessageCircle className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
              {post.commentCount}
            </Link>

            <button
              type="button"
              onClick={() => setTipOpen(true)}
              disabled={!user}
              aria-label="Tip this creator in XLM"
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Coins className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
              Tip
            </button>

            <button
              type="button"
              onClick={share}
              aria-label="Copy link to post"
              className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-brand/10 hover:text-brand"
            >
              {copied ? (
                <>
                  <Check className="h-[18px] w-[18px] text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <Share2 className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {tipOpen && (
        <TipDialog
          post={post}
          onClose={() => setTipOpen(false)}
          onTipped={() => setTipOpen(false)}
        />
      )}
    </article>
  );
}
