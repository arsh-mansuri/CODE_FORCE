import pytest
from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.examples import signup_example
from app.main import create_app
from app.schemas import Intent


@pytest.fixture
def app(tmp_path):
    return create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", media_root=tmp_path / "uploads"))


def photo_bytes(index=0):
    output = BytesIO()
    Image.new("RGB", (320, 240), color=(40 + index * 20, 90, 150)).save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def upload_photos(client):
    def upload(headers, target="profile", indices=(0, 1, 2)):
        return client.post(f"/api/media/{target}/photos", headers=headers, files=[
            ("files", (f"photo-{i}.jpg", photo_bytes(i), "image/jpeg")) for i in indices
        ])
    return upload


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def register(client, upload_photos):
    counter = 0

    def create(intent=Intent.seek_roommate, mutate=None, complete_media=True):
        nonlocal counter
        counter += 1
        body = signup_example(intent, name=f"Person {counter}", index=counter)
        if mutate:
            mutate(body)
        response = client.post("/api/auth/signup", json=body)
        assert response.status_code == 201, response.text
        data = response.json()
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        if complete_media:
            assert upload_photos(headers).status_code == 201
            if data["user"]["offering"]:
                assert upload_photos(headers, "property").status_code == 201
            data["user"] = client.get("/api/users/me", headers=headers).json()
        return data, headers, body

    return create
