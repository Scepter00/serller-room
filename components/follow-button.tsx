"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";

export function FollowButton({
  username,
  initialFollowing,
  isSelf,
}: {
  username: string;
  initialFollowing: boolean;
  isSelf: boolean;
}) {
  const { user } = useSession();
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (isSelf) return null;

  async function toggle() {
    if (!user) {
      router.push("/");
      return;
    }
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      await api(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      onClick={toggle}
      loading={busy}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
