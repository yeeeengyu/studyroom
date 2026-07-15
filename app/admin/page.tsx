"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FilePenLine, ImagePlus, MessageSquare, Music, Sparkles, Trash2 } from "lucide-react";
import { MarkdownImage } from "@/components/MarkdownImage";
import { SpotifyMarkdownParagraph } from "@/components/SpotifyMarkdownParagraph";
import { apiDelete, apiGet, apiPost, apiPut, assetUrl } from "@/lib/api";
import { createSpotifyDirective } from "@/lib/spotify";
import type { Category, PostDetail, PostSummary, RecentComment } from "@/lib/types";

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

const DRAFT_STORAGE_KEY = "studyroom-admin-draft";

type StoredDraft = {
  version: 1;
  editingSlug: string | null;
  draft: Draft;
  savedAt: string;
};

type Toast = {
  id: number;
  message: string;
  tone: "info" | "error";
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [spotifyPanelOpen, setSpotifyPanelOpen] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState("");
  const latestDraft = useRef(draft);
  const latestEditingSlug = useRef(editingSlug);
  const nextToastId = useRef(0);

  latestDraft.current = draft;
  latestEditingSlug.current = editingSlug;

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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredDraft;
        if (parsed.version === 1 && isDraft(parsed.draft)) {
          setEditingSlug(typeof parsed.editingSlug === "string" ? parsed.editingSlug : null);
          setDraft(parsed.draft);
          setDraftSaveStatus(`임시 저장본을 복구했습니다. (${formatDraftTime(parsed.savedAt)})`);
        }
      }
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } finally {
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!draftRestored) return;

    setDraftSaveStatus("임시 저장 중…");
    const timer = window.setTimeout(() => {
      const savedAt = saveDraftToBrowser(draft, editingSlug);
      setDraftSaveStatus(savedAt ? `임시 저장됨 (${formatDraftTime(savedAt)})` : "");
    }, 500);

    return () => window.clearTimeout(timer);
  }, [draft, editingSlug, draftRestored]);

  useEffect(() => {
    if (!draftRestored) return;

    const saveLatestDraft = () => {
      saveDraftToBrowser(latestDraft.current, latestEditingSlug.current);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveLatestDraft();
    };

    window.addEventListener("pagehide", saveLatestDraft);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      saveLatestDraft();
      window.removeEventListener("pagehide", saveLatestDraft);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [draftRestored]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, toast.tone === "error" ? 5000 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string, tone: Toast["tone"] = "info") {
    nextToastId.current += 1;
    setToast({ id: nextToastId.current, message, tone });
  }

  async function refresh() {
    const [nextPosts, nextCategories, nextComments] = await Promise.all([
      apiGet<PostSummary[]>("/api/posts"),
      apiGet<Category[]>("/api/categories"),
      apiGet<RecentComment[]>("/api/admin/comments?limit=12"),
    ]);
    setPosts(nextPosts);
    setCategories(nextCategories);
    setRecentComments(nextComments);
    setDraft((current) => ({
      ...current,
      categoryId: current.categoryId || nextCategories[0]?.id || "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    showToast("저장 중입니다.");
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
      showToast("저장되었습니다.");
      clearBrowserDraft();
      setEditingSlug(null);
      setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "저장하지 못했습니다.", "error");
    }
  }

  async function editPost(slug: string) {
    try {
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : "글을 불러오지 못했습니다.", "error");
    }
  }

  async function deletePost(slug: string) {
    if (!confirm("이 글을 삭제할까요?")) return;
    try {
      await apiDelete(`/api/posts/${encodeURIComponent(slug)}`);
      if (editingSlug === slug) {
        setEditingSlug(null);
        setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
      }
      await refresh();
      showToast("글을 삭제했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "글을 삭제하지 못했습니다.", "error");
    }
  }

  async function deleteRecentComment(comment: RecentComment) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    try {
      await apiDelete(`/api/posts/${encodeURIComponent(comment.post.slug)}/comments/${comment.id}`);
      setRecentComments((current) => current.filter((item) => item.id !== comment.id));
      showToast("댓글을 삭제했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "댓글을 삭제하지 못했습니다.", "error");
    }
  }

  async function uploadImageFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiPost<{ url: string }>("/api/uploads", form);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, mode: "thumbnail" | "content") {
    const file = event.target.files?.[0];
    if (!file) return;
    showToast("이미지를 업로드하는 중입니다.");
    try {
      const result = await uploadImageFile(file);
      if (mode === "thumbnail") {
        setDraft((current) => ({ ...current, thumbnailUrl: result.url }));
      } else {
        setDraft((current) => ({
          ...current,
          content: `${current.content}\n\n![${file.name}](${result.url})\n`,
        }));
      }
      showToast(mode === "thumbnail" ? "썸네일을 추가했습니다." : "본문 이미지를 추가했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다.", "error");
    } finally {
      event.target.value = "";
    }
  }

  async function pasteImages(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = imagesFromClipboard(event.clipboardData);
    if (files.length === 0) return;

    event.preventDefault();
    const selectionStart = event.currentTarget.selectionStart ?? draft.content.length;
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
    showToast("붙여넣은 이미지를 업로드하는 중입니다.");

    try {
      const markdownBlocks = await Promise.all(
        files.map(async (file, index) => {
          const result = await uploadImageFile(file);
          const label = file.name || `clipboard-image-${index + 1}`;
          return `![${label}](${result.url})`;
        }),
      );
      const insertion = `\n\n${markdownBlocks.join("\n\n")}\n`;

      setDraft((current) => {
        const start = Math.min(selectionStart, current.content.length);
        const end = Math.min(selectionEnd, current.content.length);
        return {
          ...current,
          content: `${current.content.slice(0, start)}${insertion}${current.content.slice(end)}`,
        };
      });
      showToast(files.length > 1 ? `${files.length}개의 이미지를 추가했습니다.` : "붙여넣은 이미지를 추가했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "붙여넣은 이미지를 업로드하지 못했습니다.", "error");
    }
  }

  async function summarize() {
    showToast("요약을 생성하는 중입니다.");
    try {
      const result = await apiPost<{ summary: string }>("/api/ai/summarize", {
        title: draft.title,
        content: draft.content,
      });
      setDraft((current) => ({ ...current, summary: result.summary }));
      showToast("요약이 생성되었습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요약을 생성하지 못했습니다.", "error");
    }
  }

  function insertSpotifyBlock() {
    const directive = createSpotifyDirective(spotifyUrl);
    if (!directive) {
      setSpotifyStatus("Spotify 링크를 확인해주세요.");
      return;
    }

    setDraft((current) => {
      const content = current.content.trimEnd();
      return {
        ...current,
        content: `${content}${content ? "\n\n" : ""}${directive}\n`,
      };
    });
    setSpotifyUrl("");
    setSpotifyStatus("");
    setSpotifyPanelOpen(false);
    showToast("음악 블록을 추가했습니다.");
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
                clearBrowserDraft();
                setEditingSlug(null);
                setDraft({ ...emptyDraft, categoryId: categories[0]?.id || "" });
                setDraftSaveStatus("");
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
          <button className="secondary-button" type="button" onClick={() => setSpotifyPanelOpen((open) => !open)}>
            <Music size={16} /> 음악 추가
          </button>
        </div>

        {spotifyPanelOpen && (
          <div className="spotify-insert-panel">
            <input
              aria-label="Spotify URL"
              placeholder="https://open.spotify.com/track/..."
              value={spotifyUrl}
              onChange={(event) => {
                setSpotifyUrl(event.target.value);
                setSpotifyStatus("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertSpotifyBlock();
                }
              }}
            />
            <button className="primary-button" type="button" onClick={insertSpotifyBlock}>
              추가
            </button>
            {spotifyStatus && <p className="form-error">{spotifyStatus}</p>}
          </div>
        )}

        {draft.thumbnailUrl && <img className="thumb-preview" src={assetUrl(draft.thumbnailUrl)} alt="썸네일 미리보기" />}

        <div data-color-mode="light" className="markdown-editor-wrap">
          <MDEditor
            value={draft.content}
            onChange={(value) => setDraft({ ...draft, content: value || "" })}
            height={430}
            textareaProps={{
              onPaste: pasteImages,
            }}
            previewOptions={{
              components: {
                img: MarkdownImage,
                p: SpotifyMarkdownParagraph,
              },
            }}
          />
        </div>

        {draftSaveStatus && <p className="form-status">{draftSaveStatus}</p>}
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

        <div className="side-divider" />

        <div className="panel-heading">
          <div>
            <p className="eyebrow">Comments</p>
            <h2><MessageSquare size={18} /> 최근 댓글</h2>
          </div>
        </div>
        <div className="compact-list">
          {recentComments.map((comment) => (
            <div className="compact-item admin-comment-item" key={comment.id}>
              <div className="admin-comment-copy">
                <strong>{comment.author}</strong>
                <span>{comment.post.title} · {formatDateTime(comment.createdAt)}</span>
                <p>{comment.content}</p>
              </div>
              <div className="icon-actions">
                <Link href={`/posts/${encodeURIComponent(comment.post.slug)}`} title="글 보기">
                  <ExternalLink size={15} />
                </Link>
                <button type="button" title="삭제" onClick={() => deleteRecentComment(comment)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {recentComments.length === 0 && <div className="empty-state compact">아직 댓글이 없습니다.</div>}
        </div>
      </aside>

      {toast && (
        <div
          className={`admin-toast ${toast.tone === "error" ? "error" : ""}`}
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function imagesFromClipboard(data: DataTransfer) {
  const itemFiles = Array.from(data.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (itemFiles.length > 0) return itemFiles;
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

function saveDraftToBrowser(draft: Draft, editingSlug: string | null) {
  if (!hasDraftContent(draft)) {
    clearBrowserDraft();
    return null;
  }

  const savedAt = new Date().toISOString();
  const stored: StoredDraft = {
    version: 1,
    editingSlug,
    draft,
    savedAt,
  };
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
  return savedAt;
}

function clearBrowserDraft() {
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}

function hasDraftContent(draft: Draft) {
  return Boolean(
    draft.title.trim()
    || draft.thumbnailUrl.trim()
    || draft.summary.trim()
    || draft.content.trim(),
  );
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<keyof Draft, unknown>;
  return typeof candidate.title === "string"
    && typeof candidate.categoryId === "string"
    && typeof candidate.thumbnailUrl === "string"
    && typeof candidate.summary === "string"
    && typeof candidate.content === "string";
}

function formatDraftTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "방금 전";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
