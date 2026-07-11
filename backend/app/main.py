from pathlib import Path
import uuid

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.schemas import CategoryCreate, CategoryUpdate, LoginRequest, PostCreate, PostUpdate, SummarizeRequest
from app.security import clear_session, issue_session, require_admin, verify_password
from app.storage import (
    categories,
    category_by_slug,
    create_category,
    create_post,
    delete_category,
    delete_post,
    ensure_data,
    increment_view_count,
    post_by_slug,
    posts,
    read_post_body,
    update_category,
    update_post,
    with_category,
)
from app.summary_service import summarize_markdown


settings = get_settings()
ensure_data()

app = FastAPI(title="Studyroom Blog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, str]:
    if payload.username != settings.admin_username or not verify_password(payload.password, settings.admin_password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    issue_session(response, payload.username, settings)
    return {"username": payload.username}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    clear_session(response, settings)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": username}


@app.get("/api/categories")
def list_categories() -> list[dict]:
    return categories()


@app.post("/api/categories", dependencies=[Depends(require_admin)])
def add_category(payload: CategoryCreate) -> dict:
    return create_category(payload.name.strip())


@app.put("/api/categories/{category_id}", dependencies=[Depends(require_admin)])
def rename_category(category_id: str, payload: CategoryUpdate) -> dict:
    return update_category(category_id, payload.name.strip())


@app.delete("/api/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def remove_category(category_id: str) -> Response:
    delete_category(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/posts")
def list_posts(category: str | None = Query(default=None)) -> list[dict]:
    items = posts()
    if category:
        selected = category_by_slug(category)
        if not selected:
            return []
        items = [post for post in items if post["categoryId"] == selected["id"]]
    return [with_category(post) for post in items]


@app.get("/api/posts/{slug}")
def get_post(slug: str, track: bool = Query(default=True)) -> dict:
    post = increment_view_count(slug) if track else with_category(_require_post(slug))
    post["content"] = read_post_body(post["slug"])
    return post


@app.post("/api/posts", dependencies=[Depends(require_admin)])
async def add_post(payload: PostCreate) -> dict:
    data = payload.model_dump()
    if settings.auto_summarize_on_save and not data.get("summary"):
        data["summary"] = await summarize_markdown(data["title"], data["content"])
    return create_post(data)


@app.put("/api/posts/{slug}", dependencies=[Depends(require_admin)])
async def edit_post(slug: str, payload: PostUpdate) -> dict:
    data = payload.model_dump()
    if settings.auto_summarize_on_save and not data.get("summary"):
        data["summary"] = await summarize_markdown(data["title"], data["content"])
    return update_post(slug, data)


@app.delete("/api/posts/{slug}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def remove_post(slug: str) -> Response:
    delete_post(slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/uploads", dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미지 파일만 업로드할 수 있습니다.")
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        extension = ".png"
    filename = f"{uuid.uuid4().hex}{extension}"
    destination = settings.uploads_dir / filename
    destination.write_bytes(await file.read())
    return {"url": f"/uploads/{filename}"}


@app.post("/api/ai/summarize", dependencies=[Depends(require_admin)])
async def summarize(payload: SummarizeRequest) -> dict[str, str]:
    summary = await summarize_markdown(payload.title, payload.content)
    return {"summary": summary}


def _require_post(slug: str) -> dict:
    post = post_by_slug(slug)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="글을 찾을 수 없습니다.")
    return post
