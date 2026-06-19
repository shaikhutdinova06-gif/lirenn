import json
import os
import tempfile
import shutil
from unittest.mock import patch

from backend.services import storage


class TestStorageHelpers:
    """Tests for storage functions that use the filesystem."""

    def setup_method(self):
        self._tmp = tempfile.mkdtemp(prefix="lirenn_storage_test_")
        self._orig_data_dir = storage.DATA_DIR
        self._orig_file = storage.FILE
        self._orig_data_file = storage.DATA_FILE
        self._orig_backup_dir = storage.BACKUP_DIR
        self._orig_backup1 = storage.BACKUP1
        self._orig_backup2 = storage.BACKUP2
        self._orig_backup3 = storage.BACKUP3

        storage.DATA_DIR = self._tmp
        storage.FILE = os.path.join(self._tmp, "points.json")
        storage.DATA_FILE = storage.FILE
        storage.BACKUP_DIR = os.path.join(self._tmp, "backups")
        storage.BACKUP1 = os.path.join(storage.BACKUP_DIR, "b1.json")
        storage.BACKUP2 = os.path.join(storage.BACKUP_DIR, "b2.json")
        storage.BACKUP3 = os.path.join(storage.BACKUP_DIR, "b3.json")
        os.makedirs(storage.BACKUP_DIR, exist_ok=True)

        # Reset startup_points so get_points reads from file
        storage.startup_points = None

    def teardown_method(self):
        storage.DATA_DIR = self._orig_data_dir
        storage.FILE = self._orig_file
        storage.DATA_FILE = self._orig_data_file
        storage.BACKUP_DIR = self._orig_backup_dir
        storage.BACKUP1 = self._orig_backup1
        storage.BACKUP2 = self._orig_backup2
        storage.BACKUP3 = self._orig_backup3
        shutil.rmtree(self._tmp, ignore_errors=True)

    def _write_points(self, points):
        with open(storage.FILE, "w", encoding="utf-8") as f:
            json.dump(points, f)

    def test_load_points_empty(self):
        result = storage.load_points()
        assert result == []

    def test_load_points_with_data(self):
        self._write_points([{"id": "1", "lat": 55}])
        result = storage.load_points()
        assert len(result) == 1
        assert result[0]["id"] == "1"

    def test_get_points_empty_file(self):
        result = storage.get_points()
        assert result == []

    def test_get_points_with_data(self):
        self._write_points([{"id": "a"}, {"id": "b"}])
        result = storage.get_points()
        assert len(result) == 2

    def test_save_point(self):
        self._write_points([])
        point = {"id": "p1", "user_id": "u1", "lat": 55, "lng": 37}
        storage.save_point(point)
        data = json.load(open(storage.FILE, encoding="utf-8"))
        assert any(p["id"] == "p1" for p in data)

    def test_get_user_points(self):
        self._write_points([
            {"id": "1", "user_id": "alice"},
            {"id": "2", "user_id": "bob"},
            {"id": "3", "user_id": "alice"},
        ])
        result = storage.get_user_points("alice")
        assert len(result) == 2

    def test_delete_user_point(self):
        self._write_points([
            {"id": "x", "user_id": "u1"},
            {"id": "y", "user_id": "u1"},
        ])
        storage.delete_user_point("u1", "x")
        data = json.load(open(storage.FILE, encoding="utf-8"))
        ids = [p["id"] for p in data]
        assert "x" not in ids
        assert "y" in ids

    def test_get_all_points(self):
        self._write_points([{"id": "1"}, {"id": "2"}])
        result = storage.get_all_points()
        assert len(result) == 2

    def test_get_point_history(self):
        self._write_points([
            {"id": "1", "lat": 55.0, "lng": 37.0},
            {"id": "2", "lat": 55.0001, "lng": 37.0},  # close enough
            {"id": "3", "lat": 60.0, "lng": 40.0},
        ])
        result = storage.get_point_history(55.0, 37.0)
        assert len(result) == 1  # only exact match within tolerance

    def test_recover_from_backup(self):
        # No main file, write a backup
        with open(storage.BACKUP1, "w") as f:
            json.dump([{"id": "recovered"}], f)

        result = storage.recover_from_backup()
        assert result is True
        data = json.load(open(storage.FILE, encoding="utf-8"))
        assert data[0]["id"] == "recovered"

    def test_recover_no_backups(self):
        result = storage.recover_from_backup()
        assert result is False

    def test_initialize_test_location(self):
        storage.initialize_test_location()  # should not raise

    def test_load_points_corrupted_file(self):
        with open(storage.DATA_FILE, "w") as f:
            f.write("NOT JSON{{{")
        result = storage.load_points()
        assert result == []
