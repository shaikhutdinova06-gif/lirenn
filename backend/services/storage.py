import json
import os
import uuid
import shutil
from datetime import datetime

from backend.services.file_utils import (
    DATA_DIR,
    atomic_json_save,
    ensure_data_dir,
    recover_from_backups,
    rotate_backups,
    safe_json_load,
)

DATA_FILE = DATA_DIR + "/points.json"
FILE = DATA_FILE
BACKUP_DIR = DATA_DIR + "/backups"

print(f"[STORAGE] Initializing enhanced storage...")
print(f"[STORAGE] DATA_DIR: {DATA_DIR}")
print(f"[STORAGE] DATA_FILE: {DATA_FILE}")
print(f"[STORAGE] BACKUP_DIR: {BACKUP_DIR}")

try:
    ensure_data_dir()
    os.makedirs(BACKUP_DIR, exist_ok=True)
    print(f"[STORAGE] Directories created/verified")
except Exception as e:
    print(f"[STORAGE] ERROR creating directories: {e}")

def startup_recovery():
    """Восстановление данных при запуске приложения"""
    print("[STORAGE] Starting startup recovery...")

    if os.path.exists(FILE):
        try:
            with open(FILE, "r", encoding="utf-8") as f:
                points = json.load(f)
            print(f"[STORAGE] Main file OK: {len(points)} points")
            return points
        except Exception as e:
            print(f"[STORAGE] Main file corrupted: {e}")

    if recover_from_backups(FILE, BACKUP_DIR):
        try:
            with open(FILE, "r", encoding="utf-8") as f:
                points = json.load(f)
            print(f"[STORAGE] Recovered: {len(points)} points")
            return points
        except Exception:
            pass

    print("[STORAGE] No valid backup found, starting fresh")
    return []

# Выполняем восстановление при импорте
startup_points = startup_recovery()

def get_points():
    """Чтение точек с использованием восстановленных данных"""
    global startup_points

    if startup_points is not None:
        points = startup_points
        startup_points = None
        print(f"[STORAGE] Using startup recovery: {len(points)} points")
        return points

    if not os.path.exists(FILE):
        print(f"[STORAGE] File not found: {FILE}")
        if recover_from_backups(FILE, BACKUP_DIR):
            print("[STORAGE] Recovered from backup")
        else:
            print("[STORAGE] No backup found, starting fresh")
        return []

    try:
        with open(FILE, "r", encoding="utf-8") as f:
            points = json.load(f)
            print(f"[STORAGE] Successfully loaded {len(points)} points")
            return points
    except (json.JSONDecodeError, IOError) as e:
        print(f"[STORAGE] Error reading main file: {e}")
        if recover_from_backups(FILE, BACKUP_DIR):
            try:
                with open(FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

def load_points():
    return safe_json_load(DATA_FILE, default=[])

def save_point(point):
    print(f"[STORAGE] save_point() called")
    print(f"[STORAGE] Point ID: {point.get('id')}")
    print(f"[STORAGE] Point user_id: {point.get('user_id')}")

    points = get_points()
    points.append(point)
    print(f"[STORAGE] Total points after append: {len(points)}")

    rotate_backups(FILE, BACKUP_DIR)

    try:
        atomic_json_save(FILE, points)
        print(f"[STORAGE] Global point saved successfully")
    except Exception as e:
        print(f"[STORAGE] Global save failed: {e}")

    user_id = point.get('user_id')
    if user_id:
        try:
            user_data = get_user_data(user_id)
            if 'points' not in user_data:
                user_data['points'] = []

            existing_ids = {p.get('id') for p in user_data['points']}
            if point.get('id') in existing_ids:
                user_data['points'] = [p if p.get('id') != point.get('id') else point for p in user_data['points']]
            else:
                user_data['points'].append(point)

            save_user_data(user_id, user_data)
        except Exception as e:
            print(f"[STORAGE] Error saving to user profile: {e}")

    print(f"[STORAGE] Point saved successfully")
    return {"success": True, "message": "Point saved"}

# recover_from_backup is now replaced by recover_from_backups in file_utils

def get_user_points(user_id):
    return [p for p in get_points() if p.get("user_id") == user_id]

def add_measurement_to_point(point_id, measurement_data, user_id):
    """
    Добавить новое измерение к существующей точке
    measurement_data: {ph, moisture, nitrogen, phosphorus, potassium, notes}
    """
    points = get_points()

    for point in points:
        if point.get("id") == point_id and point.get("user_id") == user_id:
            rotate_backups(FILE, BACKUP_DIR)

            if "measurements" not in point:
                point["measurements"] = []

            measurement = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "ph": measurement_data.get("ph"),
                "moisture": measurement_data.get("moisture"),
                "nitrogen": measurement_data.get("nitrogen"),
                "phosphorus": measurement_data.get("phosphorus"),
                "potassium": measurement_data.get("potassium"),
                "notes": measurement_data.get("notes", ""),
                "added_by": user_id
            }

            point["measurements"].append(measurement)
            point["last_updated"] = datetime.utcnow().isoformat()

            atomic_json_save(FILE, points)
            print(f"[STORAGE] Measurement added. Total: {len(point['measurements'])}")
            return {"success": True, "measurement": measurement, "total": len(point["measurements"])}

    return {"error": "Point not found or access denied"}

def get_point_measurements(point_id, user_id):
    """Получить историю измерений точки"""
    points = get_points()
    
    for point in points:
        if point.get("id") == point_id:
            # Проверяем права доступа
            if point.get("user_id") == user_id:
                measurements = point.get("measurements", [])
                # Сортируем по дате
                measurements.sort(key=lambda x: x.get("timestamp", ""))
                return measurements
    
    return []

def get_user_data(user_id):
    users_file = DATA_DIR + "/user_data.json"
    backup_file = DATA_DIR + "/user_data.backup"
    default_data = {"annotations": [], "settings": {}, "points": []}

    all_data = safe_json_load(users_file, default=None)

    if all_data is None:
        # Main file missing or corrupted — try backup
        if os.path.exists(backup_file):
            try:
                with open(backup_file, "r", encoding="utf-8") as f:
                    all_data = json.load(f)
                shutil.copy2(backup_file, users_file)
                print(f"[USER_DATA] Recovered from backup for user {user_id}")
            except Exception as e:
                print(f"[USER_DATA] Backup recovery failed: {e}")
                return default_data
        else:
            return default_data

    return all_data.get(user_id, default_data)

def save_user_data(user_id, data):
    users_file = DATA_DIR + "/user_data.json"
    backup_file = DATA_DIR + "/user_data.backup"

    if "points" not in data:
        data["points"] = []

    print(f"[USER_DATA] Saving data for user {user_id}: {len(data.get('points', []))} points")

    # Create backup before saving
    if os.path.exists(users_file):
        try:
            shutil.copy2(users_file, backup_file)
        except Exception as e:
            print(f"[USER_DATA] Backup creation failed: {e}")

    all_data = safe_json_load(users_file, default={})
    all_data[user_id] = data

    try:
        atomic_json_save(users_file, all_data)
        print(f"[USER_DATA] Successfully saved data for user {user_id}")
        return {"success": True, "message": "User data saved successfully"}
    except Exception as e:
        print(f"[USER_DATA] Error saving user data file: {e}")
        return {"error": f"Failed to save user data: {str(e)}"}

def initialize_test_location():
    pass

def delete_user_point(user_id, point_id):
    points = get_points()
    points = [p for p in points if not (p.get("id") == point_id and p.get("user_id") == user_id)]
    atomic_json_save(FILE, points)
    return True

def get_all_points():
    return load_points()

def get_point_history(lat, lng):
    points = load_points()
    return [
        p for p in points
        if abs(p.get("lat", 0) - lat) < 0.0001 and abs(p.get("lng", 0) - lng) < 0.0001
    ]
