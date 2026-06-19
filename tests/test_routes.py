import json
import os
import tempfile
import shutil

import pytest
from fastapi.testclient import TestClient

from backend.services import storage, auth
from backend.api.routes import router, haversine
from main import app

client = TestClient(app)


def _setup_storage(tmp):
    """Point storage module at a temp directory."""
    storage.DATA_DIR = tmp
    storage.FILE = os.path.join(tmp, "points.json")
    storage.DATA_FILE = storage.FILE
    storage.BACKUP_DIR = os.path.join(tmp, "backups")
    storage.BACKUP1 = os.path.join(storage.BACKUP_DIR, "b1.json")
    storage.BACKUP2 = os.path.join(storage.BACKUP_DIR, "b2.json")
    storage.BACKUP3 = os.path.join(storage.BACKUP_DIR, "b3.json")
    os.makedirs(storage.BACKUP_DIR, exist_ok=True)
    storage.startup_points = None


def _setup_auth(tmp):
    auth.DATA_DIR = tmp
    auth.USERS_FILE = os.path.join(tmp, "users.json")


def _register_and_get_token(username="testuser", password="testpass"):
    """Helper: register a user and return a valid Bearer token."""
    _resp = client.post("/api/register", json={"username": username, "password": password})
    resp = client.post("/api/login", json={"username": username, "password": password})
    return resp.json()["access_token"]


@pytest.fixture(autouse=True)
def _tmp_data_dir():
    tmp = tempfile.mkdtemp(prefix="lirenn_routes_test_")
    _setup_storage(tmp)
    _setup_auth(tmp)
    yield
    shutil.rmtree(tmp, ignore_errors=True)


class TestHaversine:
    def test_same_point(self):
        assert haversine(55.75, 37.62, 55.75, 37.62) == 0.0

    def test_known_distance(self):
        # Moscow to St Petersburg ≈ ~634 km
        d = haversine(55.7558, 37.6173, 59.9343, 30.3351)
        assert 600 < d < 700


class TestRegisterEndpoint:
    def test_register_success(self):
        resp = client.post("/api/register", json={"username": "new_user", "password": "pass123"})
        assert resp.status_code == 200
        assert resp.json().get("status") == "ok"

    def test_register_missing_fields(self):
        resp = client.post("/api/register", json={"username": "u"})
        assert resp.status_code == 400

    def test_register_duplicate(self):
        client.post("/api/register", json={"username": "dup", "password": "p"})
        resp = client.post("/api/register", json={"username": "dup", "password": "p2"})
        assert resp.status_code == 400


class TestLoginEndpoint:
    def test_login_success(self):
        client.post("/api/register", json={"username": "login_user", "password": "pw"})
        resp = client.post("/api/login", json={"username": "login_user", "password": "pw"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        client.post("/api/register", json={"username": "u2", "password": "right"})
        resp = client.post("/api/login", json={"username": "u2", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_missing_fields(self):
        resp = client.post("/api/login", json={"username": "x"})
        assert resp.status_code == 400


class TestPointsEndpoint:
    def test_get_points_empty(self):
        resp = client.get("/api/points")
        assert resp.status_code == 200
        assert resp.json() == []


class TestSoilTypesEndpoint:
    def test_get_soil_types(self):
        resp = client.get("/api/soil-types")
        assert resp.status_code == 200
        data = resp.json()
        assert "soil_types" in data
        assert len(data["soil_types"]) > 0


class TestUserCabinetEndpoint:
    def test_no_auth(self):
        resp = client.get("/api/user-cabinet")
        assert resp.status_code == 401

    def test_with_auth(self):
        token = _register_and_get_token("cab_user", "pw")
        resp = client.get("/api/user-cabinet", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "cab_user"


class TestDeletePointEndpoint:
    def test_no_auth(self):
        resp = client.delete("/api/delete-point?point_id=abc")
        # FastAPI returns 403 (HTTPBearer) or 422 depending on version
        assert resp.status_code in (401, 403, 422)
