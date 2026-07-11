"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, Filter } from "lucide-react";
import { apiGet, assetUrl } from "@/lib/api";
import type { Category, PostSummary } from "@/lib/types";
import Link from "next/link";

export default function HomePage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Category[]>("/api/categories").then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const path = selected === "all" ? "/api/posts" : `/api/posts?category=${encodeURIComponent(selected)}`;
    setLoading(true);
    apiGet<PostSummary[]>(path)
      .then(setPosts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selected]);

  const activeCategoryName = useMemo(() => {
    if (selected === "all") return "전체 글";
    return categories.find((category) => category.slug === selected)?.name ?? "카테고리";
  }, [categories, selected]);

  return (
    <section className="page-shell">
      <div className="intro-row">
        <div>
          <h1>최인규 공부방</h1>
        </div>
        <div className="intro-stat">
          <BookOpen size={18} />
          <span>{posts.length} posts</span>
        </div>
      </div>

      <div className="filter-bar" aria-label="카테고리 필터">
        <Filter size={16} />
        <button className={selected === "all" ? "chip active" : "chip"} onClick={() => setSelected("all")}>
          전체
        </button>
        {categories.map((category) => (
          <button
            className={selected === category.slug ? "chip active" : "chip"}
            key={category.id}
            onClick={() => setSelected(category.slug)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="section-title">
        <h2>{activeCategoryName}</h2>
      </div>

      {loading ? (
        <div className="empty-state">글을 불러오는 중입니다.</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">아직 작성된 글이 없습니다.</div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <Link className="post-card" href={`/posts/${encodeURIComponent(post.slug)}`} key={post.id}>
              <div className="post-card-copy">
                <div className="post-card-meta">
                  <span>{post.category.name}</span>
                  <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                  <span className="with-icon">
                    <Eye size={14} /> {post.viewCount}
                  </span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.summary || "요약이 아직 없습니다."}</p>
              </div>
              <div className="thumb" aria-hidden="true">
                {post.thumbnailUrl ? <img src={assetUrl(post.thumbnailUrl)} alt="" /> : <span>{post.category.name}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
