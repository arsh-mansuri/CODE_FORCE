import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def spa_client(tmp_path):
    public = tmp_path / "public"
    public.mkdir()
    (public / "index.html").write_text("<!doctype html><h1>PropVibe</h1>")
    (public / "assets").mkdir()
    (public / "assets" / "app.js").write_text("console.log('PropVibe')")
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        media_root=tmp_path / "uploads",
        public_dir=public,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def test_spa_pages_assets_and_head(spa_client):
    for path in ("/", "/profile", "/connections/roommates"):
        response = spa_client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "PropVibe" in response.text
    asset = spa_client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "javascript" in asset.headers["content-type"]
    assert spa_client.head("/profile").status_code == 200
    assert spa_client.head("/profile").content == b""


def test_spa_preserves_api_docs_and_errors(spa_client):
    assert spa_client.get("/api/health").status_code == 200
    assert spa_client.get("/docs").status_code == 200
    assert "paths" in spa_client.get("/openapi.json").json()
    for path in ("/api", "/api/missing", "/api/media/files/missing", "/assets/missing.js", "/assets/missing", "/missing.ico", "/%2e%2e/private"):
        response = spa_client.get(path)
        assert response.status_code == 404
        assert "error" in response.json()
    assert spa_client.post("/profile").status_code == 405


def test_backend_works_without_frontend_build(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        media_root=tmp_path / "uploads",
        public_dir=tmp_path / "not-built",
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
