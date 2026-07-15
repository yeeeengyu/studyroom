"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, MessageSquare, Trash2 } from "lucide-react";
import { MarkdownImage } from "@/components/MarkdownImage";
import { SpotifyMarkdownParagraph } from "@/components/SpotifyMarkdownParagraph";
import { apiDelete, apiGet, apiPost, assetUrl } from "@/lib/api";
import type { Comment, PostDetail } from "@/lib/types";

export default function PostDetailPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const slug = params.slug ? decodeURIComponent(params.slug) : "";

  useEffect(() => {
    if (!slug) return;
    apiGet<PostDetail>(`/api/posts/${encodeURIComponent(slug)}`)
      .then(setPost)
      .catch(() => setError("글을 불러오지 못했습니다."));
    apiGet<Comment[]>(`/api/posts/${encodeURIComponent(slug)}/comments`)
      .then(setComments)
      .catch(console.error);
    apiGet("/api/auth/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, [slug]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) return;
    setCommentStatus("댓글을 저장하는 중입니다.");
    try {
      const next = await apiPost<Comment>(`/api/posts/${encodeURIComponent(slug)}/comments`, {
        author: commentAuthor,
        content: commentContent,
      });
      setComments((current) => [...current, next]);
      setCommentAuthor("");
      setCommentContent("");
      setCommentStatus("댓글이 등록되었습니다.");
    } catch (commentError) {
      setCommentStatus(commentError instanceof Error ? commentError.message : "댓글을 등록하지 못했습니다.");
    }
  }

  async function removeComment(commentId: string) {
    if (!slug || !confirm("이 댓글을 삭제할까요?")) return;
    await apiDelete(`/api/posts/${encodeURIComponent(slug)}/comments/${commentId}`);
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

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
            img: MarkdownImage,
            p: SpotifyMarkdownParagraph,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
      <section className="comments-section">
        <div className="comments-heading">
          <h2><MessageSquare size={18} /> 댓글 {comments.length}</h2>
        </div>
        <form className="comment-form" onSubmit={submitComment}>
          <input
            value={commentAuthor}
            onChange={(event) => setCommentAuthor(event.target.value)}
            placeholder="이름"
            maxLength={40}
            required
          />
          <textarea
            value={commentContent}
            onChange={(event) => setCommentContent(event.target.value)}
            placeholder="댓글을 남기면 최인규가 친절하게 답해드립니다"
            maxLength={1000}
            rows={4}
            required
          />
          <button className="primary-button" type="submit">댓글 등록</button>
          {commentStatus && <p className="form-status">{commentStatus}</p>}
        </form>
        <div className="comment-list">
          {comments.map((comment) => (
            <div className="comment-item" key={comment.id}>
              <div className="comment-meta">
                <strong>{comment.author}</strong>
                <span>{new Date(comment.createdAt).toLocaleString("ko-KR")}</span>
                {authed && (
                  <button type="button" title="댓글 삭제" onClick={() => removeComment(comment.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p>{comment.content}</p>
            </div>
          ))}
          {comments.length === 0 && <div className="empty-state compact">아직 댓글이 없습니다.</div>}
        </div>
      </section>
    </article>
  );
}
