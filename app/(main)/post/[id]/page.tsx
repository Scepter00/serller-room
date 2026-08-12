"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PostCard } from "@/components/post-card";
import { RichText } from "@/components/richtext";
import { Button, EmptyState, FullPageSpinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { signTransactionWithWallet } from "@/lib/client/wallet";
import { timeAgo } from "@/lib/utils";
import type { ApiPost } from "@/lib/feed";

interface Comment {
  id: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  author: { username: string | null; displayName: string | null; avatarUrl: string | null };
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const { user } = useSession();
  const router = useRouter();

  const [post, setPost] = useState<ApiPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [notarizing, setNotarizing] = useState(false);
  const [notaryMessage, setNotaryMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void Promise.all([
      api<{ post: ApiPost }>(`/api/posts/${postId}`),
      api<{ comments: Comment[] }>(`/api/posts/${postId}/comments`),
    ])
      .then(([p, c]) => {
        setPost(p.post);
        setComments(c.comments);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addComment() {
    if (!user || !commentText.trim()) return;
    setCommenting(true);
    try {
      await api(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: { text: commentText.trim() },
      });
      setCommentText("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not comment");
    } finally {
      setCommenting(false);
    }
  }

  async function deletePost() {
    if (!post || !window.confirm("Delete this post?")) return;
    try {
      await api(`/api/posts/${postId}`, { method: "DELETE" });
      router.push("/feed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function notarize() {
    if (!post || !user) return;
    setNotarizing(true);
    setNotaryMessage(null);
    try {
      const build = await api<{
        contentHash: string;
        unsignedXdr: string;
        networkPassphrase: string;
      }>(`/api/contract/notary/register`, { method: "POST", body: { postId } });

      const signedXdr = await signTransactionWithWallet(
        build.unsignedXdr,
        build.networkPassphrase,
        user.walletAddress
      );

      const result = await api<{ txHash: string; explorerUrl: string }>(
        `/api/contract/notary/submit`,
        { method: "POST", body: { postId, signedXdr } }
      );

      setNotaryMessage(
        `Notarized ✓ ${result.txHash}`
      );
      load();
    } catch (e) {
      setNotaryMessage(e instanceof Error ? e.message : "Notarization failed");
    } finally {
      setNotarizing(false);
    }
  }

  if (loading && !post) return <FullPageSpinner />;
  if (error && !post)
    return (
      <div className="mx-auto max-w-xl p-4">
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      </div>
    );
  if (!post) return null;

  // Authors can notarize/delete their own posts (matched by username).
  const isAuthor =
    !!user?.profile?.username && post.author.username === user.profile.username;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <PostCard post={post} />

      {/* notarize / delete actions for the author */}
      <div className="flex flex-wrap items-center gap-2">
        {!post.notarized && isAuthor && user && (
          <Button variant="secondary" size="sm" onClick={notarize} loading={notarizing}>
            <ShieldCheck className="h-4 w-4" /> Notarize on-chain
          </Button>
        )}
        {isAuthor && user && (
          <Button variant="ghost" size="sm" onClick={deletePost}>
            <Trash2 className="h-4 w-4 text-danger" /> Delete
          </Button>
        )}
      </div>

      {notaryMessage && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-t2 break-all">
          {notaryMessage}
          {notaryMessage.startsWith("Notarized ✓") && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${notaryMessage.replace("Notarized ✓ ", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-brand hover:underline"
            >
              explorer <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      )}

      {/* comments */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-t3">
          Comments ({comments.length})
        </h2>

        {user ? (
          <div className="mb-4 flex gap-3">
            <Avatar
              name={user.profile?.displayName ?? "me"}
              seed={user.walletAddress}
              src={user.profile?.avatarUrl}
              size="sm"
            />
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={addComment} loading={commenting} disabled={!commentText.trim()}>
                  Comment
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-t2">
            <button onClick={() => router.push("/")} className="font-semibold text-brand">
              Connect your wallet
            </button>{" "}
            to join the conversation.
          </p>
        )}

        {comments.length === 0 ? (
          <EmptyState title="No comments yet" description="Start the discussion." />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
                <Avatar
                  name={c.author.displayName ?? c.author.username ?? "u"}
                  seed={c.author.username ?? c.id}
                  src={c.author.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-xs">
                    <span className="font-semibold">
                      {c.author.displayName ?? c.author.username ?? "Anonymous"}
                    </span>{" "}
                    <span className="text-t3">@{c.author.username} · {timeAgo(c.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    <RichText text={c.text} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
