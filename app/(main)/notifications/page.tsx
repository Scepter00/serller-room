"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Coins, Heart, MessageCircle, Reply, UserPlus, AtSign } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EmptyState, FullPageSpinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  kind: string;
  read: boolean;
  postId: string | null;
  createdAt: string;
  actor: { username: string | null; displayName: string | null; avatarUrl: string | null } | null;
}

const KIND_ICONS: Record<string, typeof Heart> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  reply: Reply,
  mention: AtSign,
  tip: Coins,
};

const KIND_TEXT: Record<string, string> = {
  follow: "followed you",
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  tip: "sent you an XLM tip",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ notifications: NotificationItem[] }>("/api/notifications")
      .then((d) => setItems(d.notifications))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Bell className="h-5 w-5 text-brand" /> Notifications
      </h1>

      {loading ? (
        <FullPageSpinner />
      ) : error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No notifications yet"
          description="Follows, likes, comments, mentions and tips will show up here."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = KIND_ICONS[n.kind] ?? Bell;
            const actorName = n.actor?.displayName ?? n.actor?.username ?? "Someone";
            const href = n.postId ? `/post/${n.postId}` : n.actor?.username ? `/profile/${n.actor.username}` : "/feed";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className="card-hover flex items-start gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <Avatar
                    name={actorName}
                    seed={n.actor?.username ?? n.id}
                    src={n.actor?.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm leading-relaxed">
                      <Icon className="h-4 w-4 shrink-0 text-brand" />
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-t2">{KIND_TEXT[n.kind] ?? n.kind}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-t3">{timeAgo(n.createdAt)}</p>
                  </div>
                  <span
                    className={`mt-1.5 flex h-2 w-2 shrink-0 rounded-full ${
                      n.read ? "bg-transparent" : "bg-brand"
                    }`}
                    aria-label={n.read ? "Read" : "Unread"}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
