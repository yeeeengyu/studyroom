from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.config import get_settings


_LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", value.lower(), flags=re.UNICODE)
    slug = re.sub(r"[\s_-]+", "-", slug, flags=re.UNICODE).strip("-")
    return slug or uuid.uuid4().hex[:10]


def ensure_data() -> None:
    settings = get_settings()
    settings.posts_dir.mkdir(parents=True, exist_ok=True)
    settings.comments_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    if not settings.posts_index_path.exists():
        write_json(settings.posts_index_path, [])
    if not settings.categories_path.exists():
        timestamp = now_iso()
        write_json(
            settings.categories_path,
            [
                {
                    "id": uuid.uuid4().hex,
                    "name": "개발공부",
                    "slug": "개발공부",
                    "createdAt": timestamp,
                    "updatedAt": timestamp,
                }
            ],
        )


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def categories() -> list[dict[str, Any]]:
    ensure_data()
    return read_json(get_settings().categories_path, [])


def posts() -> list[dict[str, Any]]:
    ensure_data()
    items = read_json(get_settings().posts_index_path, [])
    return sorted(items, key=lambda item: item.get("createdAt", ""), reverse=True)


def category_by_id(category_id: str) -> dict[str, Any] | None:
    return next((category for category in categories() if category["id"] == category_id), None)


def category_by_slug(category_slug: str) -> dict[str, Any] | None:
    return next((category for category in categories() if category["slug"] == category_slug), None)


def post_by_slug(slug: str) -> dict[str, Any] | None:
    return next((post for post in posts() if post["slug"] == slug), None)


def with_category(post: dict[str, Any]) -> dict[str, Any]:
    category = category_by_id(post["categoryId"])
    if not category:
        category = {
            "id": post["categoryId"],
            "name": "미분류",
            "slug": "uncategorized",
            "createdAt": post["createdAt"],
            "updatedAt": post["updatedAt"],
        }
    public = {key: value for key, value in post.items() if key != "categoryId"}
    public["category"] = category
    return public


def unique_slug(title: str, current_slug: str | None = None) -> str:
    base = slugify(title)
    existing = {post["slug"] for post in posts() if post["slug"] != current_slug}
    candidate = base
    index = 2
    while candidate in existing:
        candidate = f"{base}-{index}"
        index += 1
    return candidate


def post_body_path(slug: str) -> Path:
    return get_settings().posts_dir / f"{slug}.md"


def read_post_body(slug: str) -> str:
    path = post_body_path(slug)
    return path.read_text(encoding="utf-8") if path.exists() else ""


def comments_path(slug: str) -> Path:
    return get_settings().comments_dir / f"{slug}.json"


def comments(slug: str) -> list[dict[str, Any]]:
    if not post_by_slug(slug):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
    items = read_json(comments_path(slug), [])
    return sorted(items, key=lambda item: item.get("createdAt", ""))


def create_comment(slug: str, payload: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        if not post_by_slug(slug):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
        timestamp = now_iso()
        comment = {
            "id": uuid.uuid4().hex,
            "author": payload["author"].strip(),
            "content": payload["content"].strip(),
            "createdAt": timestamp,
        }
        if not comment["author"] or not comment["content"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이름과 댓글을 입력해주세요.")
        items = read_json(comments_path(slug), [])
        items.append(comment)
        write_json(comments_path(slug), items)
        return comment


def delete_comment(slug: str, comment_id: str) -> None:
    with _LOCK:
        if not post_by_slug(slug):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
        path = comments_path(slug)
        items = read_json(path, [])
        remaining = [item for item in items if item["id"] != comment_id]
        if len(remaining) == len(items):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="댓글을 찾을 수 없습니다.")
        write_json(path, remaining)


def create_category(name: str) -> dict[str, Any]:
    with _LOCK:
        ensure_data()
        items = categories()
        slug = slugify(name)
        if any(item["slug"] == slug for item in items):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 있는 카테고리입니다.")
        timestamp = now_iso()
        category = {
            "id": uuid.uuid4().hex,
            "name": name,
            "slug": slug,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        items.append(category)
        write_json(get_settings().categories_path, items)
        return category


def update_category(category_id: str, name: str) -> dict[str, Any]:
    with _LOCK:
        items = categories()
        category = next((item for item in items if item["id"] == category_id), None)
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다.")
        next_slug = slugify(name)
        if any(item["slug"] == next_slug and item["id"] != category_id for item in items):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 있는 카테고리입니다.")
        category["name"] = name
        category["slug"] = next_slug
        category["updatedAt"] = now_iso()
        write_json(get_settings().categories_path, items)
        return category


def delete_category(category_id: str) -> None:
    with _LOCK:
        if any(post["categoryId"] == category_id for post in posts()):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="글에서 사용 중인 카테고리입니다.")
        items = [item for item in categories() if item["id"] != category_id]
        if len(items) == len(categories()):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다.")
        write_json(get_settings().categories_path, items)


def create_post(payload: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        if not category_by_id(payload["categoryId"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="카테고리를 선택해주세요.")
        timestamp = now_iso()
        slug = unique_slug(payload["title"])
        post = {
            "id": uuid.uuid4().hex,
            "slug": slug,
            "title": payload["title"],
            "summary": payload.get("summary", ""),
            "categoryId": payload["categoryId"],
            "thumbnailUrl": payload.get("thumbnailUrl", ""),
            "viewCount": 0,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        items = posts()
        items.append(post)
        write_json(get_settings().posts_index_path, items)
        post_body_path(slug).write_text(payload.get("content", ""), encoding="utf-8")
        return with_category(post)


def update_post(slug: str, payload: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        if not category_by_id(payload["categoryId"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="카테고리를 선택해주세요.")
        items = posts()
        post = next((item for item in items if item["slug"] == slug), None)
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
        next_slug = unique_slug(payload["title"], current_slug=slug)
        old_path = post_body_path(slug)
        post.update(
            {
                "slug": next_slug,
                "title": payload["title"],
                "summary": payload.get("summary", ""),
                "categoryId": payload["categoryId"],
                "thumbnailUrl": payload.get("thumbnailUrl", ""),
                "updatedAt": now_iso(),
            }
        )
        write_json(get_settings().posts_index_path, items)
        next_path = post_body_path(next_slug)
        next_path.write_text(payload.get("content", ""), encoding="utf-8")
        if next_slug != slug and old_path.exists():
            old_path.unlink()
        return with_category(post)


def delete_post(slug: str) -> None:
    with _LOCK:
        items = posts()
        remaining = [item for item in items if item["slug"] != slug]
        if len(remaining) == len(items):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
        write_json(get_settings().posts_index_path, remaining)
        path = post_body_path(slug)
        if path.exists():
            path.unlink()
        comment_path = comments_path(slug)
        if comment_path.exists():
            comment_path.unlink()


def increment_view_count(slug: str) -> dict[str, Any]:
    with _LOCK:
        items = posts()
        post = next((item for item in items if item["slug"] == slug), None)
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
        post["viewCount"] = int(post.get("viewCount", 0)) + 1
        write_json(get_settings().posts_index_path, items)
        return with_category(post)
