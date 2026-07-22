from fastapi.testclient import TestClient

from app import main as app_main
from app.security import hash_password


TEST_PASSWORD = "test-password"

app_main.settings.admin_password_hash = hash_password(TEST_PASSWORD)

client = TestClient(app_main.app)


def login() -> None:
    response = client.post("/api/auth/login", json={"password": TEST_PASSWORD})
    assert response.status_code == 200


def test_auth_required_for_admin_routes():
    response = client.post("/api/posts", json={})
    assert response.status_code == 401


def test_categories_available():
    response = client.get("/api/categories")
    assert response.status_code == 200
    assert response.json()


def test_create_post_and_view_count():
    login()
    category = client.get("/api/categories").json()[0]
    created = client.post(
        "/api/posts",
        json={
            "title": "테스트 글",
            "categoryId": category["id"],
            "summary": "테스트 요약",
            "thumbnailUrl": "",
            "content": "# Hello",
        },
    )
    assert created.status_code == 200
    slug = created.json()["slug"]

    first = client.get(f"/api/posts/{slug}").json()
    second = client.get(f"/api/posts/{slug}").json()
    assert second["viewCount"] == first["viewCount"] + 1

    deleted = client.delete(f"/api/posts/{slug}")
    assert deleted.status_code == 204


def test_comments_can_be_created_and_admin_deleted():
    login()
    category = client.get("/api/categories").json()[0]
    created = client.post(
        "/api/posts",
        json={
            "title": "댓글 테스트 글",
            "categoryId": category["id"],
            "summary": "",
            "thumbnailUrl": "",
            "content": "댓글 테스트",
        },
    )
    assert created.status_code == 200
    slug = created.json()["slug"]

    comment = client.post(
        f"/api/posts/{slug}/comments",
        json={"author": "방문자", "content": "좋은 글입니다."},
    )
    assert comment.status_code == 200
    comment_id = comment.json()["id"]

    comments = client.get(f"/api/posts/{slug}/comments")
    assert comments.status_code == 200
    assert comments.json()[0]["content"] == "좋은 글입니다."

    recent_comments = client.get("/api/admin/comments")
    assert recent_comments.status_code == 200
    assert recent_comments.json()[0]["id"] == comment_id
    assert recent_comments.json()[0]["post"]["slug"] == slug

    deleted_comment = client.delete(f"/api/posts/{slug}/comments/{comment_id}")
    assert deleted_comment.status_code == 204
    assert client.get(f"/api/posts/{slug}/comments").json() == []

    deleted_post = client.delete(f"/api/posts/{slug}")
    assert deleted_post.status_code == 204


def test_comment_without_author_uses_anonymous_name():
    login()
    category = client.get("/api/categories").json()[0]
    created = client.post(
        "/api/posts",
        json={
            "title": "익명 댓글 테스트 글",
            "categoryId": category["id"],
            "summary": "",
            "thumbnailUrl": "",
            "content": "익명 댓글 테스트",
        },
    )
    assert created.status_code == 200
    slug = created.json()["slug"]

    comment = client.post(
        f"/api/posts/{slug}/comments",
        json={"author": "   ", "content": "이름 없이 남겨요."},
    )
    assert comment.status_code == 200
    assert comment.json()["author"] == "익명"

    deleted_post = client.delete(f"/api/posts/{slug}")
    assert deleted_post.status_code == 204
