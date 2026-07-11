"use client";

import Link from "next/link";
import { LogOut, PenLine, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

export function Nav() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    apiGet("/api/auth/me").then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function logout() {
    await apiPost("/api/auth/logout", {});
    setAuthed(false);
    window.location.href = "/";
  }

  return (
    <header className="top-nav">
      <Link className="brand" href="/">최인규 공부방</Link>
      <nav>
        {authed ? (
          <>
            <Link href="/admin"><PenLine size={16} /> 작성</Link>
            <Link href="/settings"><Settings size={16} /> 설정</Link>
            <button onClick={logout}><LogOut size={16} /> 로그아웃</button>
          </>
        ) : (
          <Link href="/login">최인규 인증하기</Link>
        )}
      </nav>
    </header>
  );
}
