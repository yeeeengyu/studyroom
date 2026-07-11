"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { Category } from "@/lib/types";

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet("/api/auth/me")
      .then(() => refresh())
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setReady(true));
  }, []);

  async function refresh() {
    setCategories(await apiGet<Category[]>("/api/categories"));
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    await apiPost("/api/categories", { name: newName.trim() });
    setNewName("");
    setMessage("카테고리를 추가했습니다.");
    await refresh();
  }

  async function renameCategory(category: Category, name: string) {
    if (!name.trim() || name === category.name) return;
    await apiPut(`/api/categories/${category.id}`, { name: name.trim() });
    setMessage("카테고리를 수정했습니다.");
    await refresh();
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`${category.name} 카테고리를 삭제할까요?`)) return;
    try {
      await apiDelete(`/api/categories/${category.id}`);
      setMessage("카테고리를 삭제했습니다.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제할 수 없습니다.");
    }
  }

  if (!ready) return <section className="page-shell"><div className="empty-state">설정을 불러오는 중입니다.</div></section>;

  return (
    <section className="page-shell settings-shell">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>카테고리 설정</h1>
        </div>
      </div>
      <form className="inline-form" onSubmit={addCategory}>
        <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="새 카테고리 이름" />
        <button className="primary-button" type="submit"><Plus size={16} /> 추가</button>
      </form>
      <div className="compact-list">
        {categories.map((category) => (
          <CategoryRow
            category={category}
            key={category.id}
            onDelete={() => deleteCategory(category)}
            onRename={(name) => renameCategory(category, name)}
          />
        ))}
      </div>
      {message && <p className="form-status">{message}</p>}
    </section>
  );
}

function CategoryRow({
  category,
  onDelete,
  onRename,
}: {
  category: Category;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(category.name);

  useEffect(() => setName(category.name), [category.name]);

  return (
    <div className="compact-item">
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <div className="icon-actions">
        <button type="button" title="저장" onClick={() => onRename(name)}><Save size={15} /></button>
        <button type="button" title="삭제" onClick={onDelete}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}
