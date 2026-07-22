export type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: Category;
  thumbnailUrl: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PostDetail = PostSummary & {
  content: string;
};

export type Comment = {
  id: string;
  author: string;
  content: string;
  parentId?: string;
  createdAt: string;
};

export type RecentComment = Comment & {
  post: {
    id: string;
    slug: string;
    title: string;
  };
};
