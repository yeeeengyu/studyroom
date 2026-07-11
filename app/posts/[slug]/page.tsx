"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye } from "lucide-react";
import { apiGet, assetUrl } from "@/lib/api";
import type { PostDetail } from "@/lib/types";

export default function PostDetailPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.slug) return;
    const slug = decodeURIComponent(params.slug);
    apiGet<PostDetail>(`/api/posts/${encodeURIComponent(slug)}`)
      .then(setPost)
      .catch(() => setError("글을 불러오지 못했습니다."));
  }, [params.slug]);

  if (error) return <section className="page-shell"><div className="empty-state">{error}</div></section>;
  if (!post) return <section className="page-shell"><div className="empty-state">글을 불러오는 중입니다.</div></section>;

  return (
    <article className="page-shell article-shell">
      <header className="article-header">
        <div className="post-card-meta">
          <span>{post.category.name}</span>
          <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
          <span className="with-icon"><Eye size={14} /> {post.viewCount}</span>
        </div>
        <h1>{post.title}</h1>
        {post.summary && <p>{post.summary}</p>}
        {post.thumbnailUrl && <img className="article-thumb" src={assetUrl(post.thumbnailUrl)} alt="" />}
      </header>
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src = "", alt = "" }) => <img src={assetUrl(String(src))} alt={String(alt)} />,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
