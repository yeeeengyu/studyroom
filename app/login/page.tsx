"use client";

import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiPost("/api/auth/login", { password });
      window.location.href = "/admin";
    } catch {
      setError("비밀번호를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-shell">
      <form className="auth-panel" onSubmit={handleSubmit}>
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
