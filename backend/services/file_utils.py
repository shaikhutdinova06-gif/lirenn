import json
import os
import shutil
from typing import Any


DATA_DIR = os.getenv("DATA_DIR", "/data")
if os.path.exists("/app"):
    DATA_DIR = "/data"


def ensure_data_dir():
    """Create the data directory if it doesn't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)


def atomic_json_save(file_path: str, data: Any) -> None:
    """Write *data* as JSON to *file_path* atomically via a temp file.

    Creates the parent directory if needed.  On failure the temp file is
    cleaned up and the exception is re-raised.
    """
    os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
    temp_file = file_path + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if os.path.exists(file_path):
            os.replace(temp_file, file_path)
        else:
            os.rename(temp_file, file_path)
    except Exception:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
        raise


def safe_json_load(file_path: str, default: Any = None):
    """Load JSON from *file_path*, returning *default* on any failure.

    If the file is corrupted, it is renamed to ``<file_path>.backup`` before
    returning the default.
    """
    if default is None:
        default = []
    if not os.path.exists(file_path):
        return default
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"[FILE_UTILS] Error reading {file_path}: {e}")
        backup = file_path + ".backup"
        try:
            os.rename(file_path, backup)
            print(f"[FILE_UTILS] Corrupted file backed up to {backup}")
        except OSError:
            pass
        return default


def rotate_backups(main_file: str, backup_dir: str) -> None:
    """Rotate up to 3 backup copies: backup1 -> backup2 -> backup3."""
    os.makedirs(backup_dir, exist_ok=True)
    base = os.path.basename(main_file).replace(".json", "")
    b1 = os.path.join(backup_dir, f"{base}_backup1.json")
    b2 = os.path.join(backup_dir, f"{base}_backup2.json")
    b3 = os.path.join(backup_dir, f"{base}_backup3.json")

    try:
        if os.path.exists(b2):
            shutil.copy2(b2, b3)
        if os.path.exists(b1):
            shutil.copy2(b1, b2)
        if os.path.exists(main_file):
            shutil.copy2(main_file, b1)
    except Exception as e:
        print(f"[FILE_UTILS] Backup rotation failed: {e}")


def recover_from_backups(main_file: str, backup_dir: str) -> bool:
    """Try restoring *main_file* from backup copies (newest first).

    Returns True if a valid backup was restored, False otherwise.
    """
    base = os.path.basename(main_file).replace(".json", "")
    backups = [
        os.path.join(backup_dir, f"{base}_backup3.json"),
        os.path.join(backup_dir, f"{base}_backup2.json"),
        os.path.join(backup_dir, f"{base}_backup1.json"),
    ]
    for backup_file in backups:
        if os.path.exists(backup_file):
            try:
                with open(backup_file, "r", encoding="utf-8") as f:
                    json.load(f)  # validate JSON
                shutil.copy2(backup_file, main_file)
                print(f"[FILE_UTILS] Recovered {main_file} from {backup_file}")
                return True
            except Exception as e:
                print(f"[FILE_UTILS] Backup {backup_file} invalid: {e}")
                continue
    return False
