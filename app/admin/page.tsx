"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { FilePenLine, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut, assetUrl } from "@/lib/api";
import type { Category, PostDetail, PostSummary } from "@/lib/types";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Draft = {
  title: string;
  categoryId: string;
  thumbnailUrl: string;
  summary: string;
  content: string;
};

const emptyDraft: Draft = {
  title: "",
  categoryId: "",
  thumbnailUrl: "",
  summary: "",
  content: "",
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState("");

  const selectedPostTitle = useMemo(
    () => posts.find((post) => post.slug === editingSlug)?.title,
    [posts, editingSlug],
  );

  useEffect(() => {
    apiGet("/api/auth/me")
      .then(() => setAuthed(true))
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
  }, [authed]);

  async function refresh() {
    const [nextPosts, nextCategories] = await Promise.all([
      apiGet<PostSummary[]>("/api/posts"),
      apiGet<Category[]>("/api/categories"),
    ]);
    setPosts(nextPosts);
    setCategories(nextCategories);
    setDraft((current) => ({
      ...current,
      categoryId: current.categoryId || nextCategories[0]?.id || "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("저장 중입니다.");
    const payload = {
      title: draft.title,
      categoryId: draft.categoryId,
      thumbnailUrl: draft.thumbnailUrl,
      summary: draft.summary,
      content: draft.content,
    };
    try {
      if (editingSlug) {
        await apiPut(`/api/posts/${encodeURIComponent(editingSlug)}`, payload);
      } else {
        await apiPost("/api/posts", payload);
      }
      setStatus("저장되었습니다.");
      setEditingSlug(null);
      setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  async function editPost(slug: string) {
    const post = await apiGet<PostDetail>(`/api/posts/${encodeURIComponent(slug)}?track=false`);
    setEditingSlug(slug);
    setDraft({
      title: post.title,
      categoryId: post.category.id,
      thumbnailUrl: post.thumbnailUrl || "",
      summary: post.summary || "",
      content: post.content,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deletePost(slug: string) {
    if (!confirm("이 글을 삭제할까요?")) return;
    await apiDelete(`/api/posts/${encodeURIComponent(slug)}`);
    if (editingSlug === slug) {
      setEditingSlug(null);
      setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
    }
    await refresh();
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, mode: "thumbnail" | "content") {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const result = await apiPost<{ url: string }>("/api/uploads", form);
    if (mode === "thumbnail") {
      setDraft((current) => ({ ...current, thumbnailUrl: result.url }));
    } else {
      setDraft((current) => ({
        ...current,
        content: `${current.content}\n\n![${file.name}](${result.url})\n`,
      }));
    }
    event.target.value = "";
  }

  async function summarize() {
    setStatus("요약을 생성하는 중입니다.");
    const result = await apiPost<{ summary: string }>("/api/ai/summarize", {
      title: draft.title,
      content: draft.content,
    });
    setDraft((current) => ({ ...current, summary: result.summary }));
    setStatus("요약이 생성되었습니다.");
  }

  if (!ready) return <section className="page-shell"><div className="empty-state">확인 중입니다.</div></section>;
  if (!authed) return null;

  return (
    <section className="page-shell admin-grid">
      <form className="editor-panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>{editingSlug ? "글 수정" : "새 글 작성"}</h1>
          </div>
          {editingSlug && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setEditingSlug(null);
                setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
              }}
            >
              새 글
            </button>
          )}
        </div>

        <label>
          제목
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
        </label>

        <label>
          카테고리
          <select
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>

        <label>
          카드 요약
          <textarea
            rows={3}
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          />
        </label>

        <div className="button-row">
          <button className="secondary-button" type="button" onClick={summarize} disabled={!draft.content.trim()}>
            <Sparkles size={16} /> 요약 생성
          </button>
          <label className="file-button">
            <ImagePlus size={16} /> 썸네일
            <input type="file" accept="image/*" onChange={(event) => uploadImage(event, "thumbnail")} />
          </label>
          <label className="file-button">
            <ImagePlus size={16} /> 본문 이미지
            <input type="file" accept="image/*" onChange={(event) => uploadImage(event, "content")} />
          </label>
        </div>

        {draft.thumbnailUrl && <img className="thumb-preview" src={assetUrl(draft.thumbnailUrl)} alt="썸네일 미리보기" />}

        <div data-color-mode="light" className="markdown-editor-wrap">
          <MDEditor value={draft.content} onChange={(value) => setDraft({ ...draft, content: value || "" })} height={430} />
        </div>

        {status && <p className="form-status">{status}</p>}
        <button className="primary-button" type="submit">
          <FilePenLine size={16} /> {editingSlug ? "수정 저장" : "글 발행"}
        </button>
      </form>

      <aside className="side-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Posts</p>
            <h2>작성한 글</h2>
          </div>
        </div>
        <div className="compact-list">
          {posts.map((post) => (
            <div className={post.slug === editingSlug ? "compact-item active" : "compact-item"} key={post.id}>
              <div>
                <strong>{post.title}</strong>
                <span>{post.category.name} · 조회 {post.viewCount}</span>
              </div>
              <div className="icon-actions">
                <button type="button" title="수정" onClick={() => editPost(post.slug)}>{selectedPostTitle === post.title ? "선택" : "수정"}</button>
                <button type="button" title="삭제" onClick={() => deletePost(post.slug)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
          {posts.length === 0 && <div className="empty-state compact">아직 글이 없습니다.</div>}
        </div>
      </aside>
    </section>
  );
}
