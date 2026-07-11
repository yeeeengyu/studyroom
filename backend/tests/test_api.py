from fastapi.testclient import TestClient

from app import main as app_main
from app.security import hash_password


TEST_USERNAME = "test-admin"
TEST_PASSWORD = "test-password"

app_main.settings.admin_username = TEST_USERNAME
app_main.settings.admin_password_hash = hash_password(TEST_PASSWORD)

client = TestClient(app_main.app)


def login() -> None:
    response = client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
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
