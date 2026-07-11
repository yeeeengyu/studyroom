"use client";

import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiPost("/api/auth/login", { username, password });
      window.location.href = "/admin";
    } catch {
      setError("아이디 또는 비밀번호를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-shell">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <label>
          아이디
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={submitting}>
          {submitting ? "확인 중" : "로그인"}
        </button>
      </form>
    </section>
  );
}
