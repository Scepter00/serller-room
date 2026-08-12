import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function MyProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.profile?.username) redirect(`/profile/${user.profile.username}`);
  redirect("/settings");
}
