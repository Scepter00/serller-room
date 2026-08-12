export type Profile = {
  address: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
};

export type Post = {
  id: string;
  author: string;
  displayName: string;
  text: string;
  createdAt: number;
  likes: number;
  comments: Comment[];
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
};
