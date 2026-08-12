import type { Post, Profile } from "./types";

const POSTS_KEY = "serller.posts.v1";
const PROFILES_KEY = "serller.profiles.v1";

const seedPosts: Post[] = [
  { id: "seed-1", author: "G...91F2", displayName: "Stellar Builder", text: "Building on Stellar feels different when the product is designed around the user owning their identity.", createdAt: Date.now() - 1000 * 60 * 12, likes: 128, comments: [] },
  { id: "seed-2", author: "G...42AC", displayName: "Gwen ✦", text: "Just shipped my first Soroban contract. Small contract, huge feeling. 🚀", createdAt: Date.now() - 1000 * 60 * 60, likes: 84, comments: [] },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

export function getPosts(): Post[] { return read<Post[]>(POSTS_KEY, seedPosts); }
export function savePosts(posts: Post[]) { window.localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); }
export function getProfiles(): Profile[] { return read<Profile[]>(PROFILES_KEY, []); }
export function saveProfiles(profiles: Profile[]) { window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); }

export function shortAddress(address: string) { return `${address.slice(0, 4)}...${address.slice(-4)}`; }
