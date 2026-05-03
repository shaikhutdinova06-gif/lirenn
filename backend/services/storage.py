import json
import os
import uuid
from datetime import datetime

# Используем /data для Docker/Amvera, data для локальной разработки
DATA_DIR = os.getenv("DATA_DIR", "/data")
DATA_FILE = DATA_DIR + "/points.json"
FILE = DATA_FILE

print(f"[STORAGE] Initializing storage...")
print(f"[STORAGE] DATA_DIR: {DATA_DIR}")
print(f"[STORAGE] DATA_FILE: {DATA_FILE}")
print(f"[STORAGE] Current working directory: {os.getcwd()}")
print(f"[STORAGE] Directory exists before makedirs: {os.path.exists(DATA_DIR)}")

try:
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"[STORAGE] Directory created/verified: {DATA_DIR}")
    print(f"[STORAGE] Directory exists after makedirs: {os.path.exists(DATA_DIR)}")
    print(f"[STORAGE] Directory is writable: {os.access(DATA_DIR, os.W_OK)}")
except Exception as e:
    print(f"[STORAGE] ERROR creating directory: {e}")

def get_points():
    print(f"[STORAGE] get_points() called")
    print(f"[STORAGE] Looking for file: {FILE}")
    print(f"[STORAGE] File exists: {os.path.exists(FILE)}")
    
    if not os.path.exists(FILE):
        print(f"[STORAGE] File not found, returning empty list")
        return []
    try:
        with open(FILE, encoding="utf-8") as f:
            points = json.load(f)
        print(f"[STORAGE] Loaded {len(points)} points from file")
        return points
    except (json.JSONDecodeError, IOError) as e:
        print(f"[STORAGE] Error reading points file: {e}")
        if os.path.exists(FILE):
            backup_file = FILE + ".backup"
            try:
                os.rename(FILE, backup_file)
                print(f"[STORAGE] Corrupted file backed up to {backup_file}")
            except:
                pass
        return []

def load_points():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading points file: {e}")
        if os.path.exists(DATA_FILE):
            backup_file = DATA_FILE + ".backup"
            try:
                os.rename(DATA_FILE, backup_file)
                print(f"Corrupted file backed up to {backup_file}")
            except:
                pass
        return []
def save_point(point):
    print(f"[STORAGE] save_point() called")
    print(f"[STORAGE] Point ID: {point.get('id')}")
    print(f"[STORAGE] Point user_id: {point.get('user_id')}")
    print(f"[STORAGE] DATA_DIR exists: {os.path.exists(DATA_DIR)}")
    print(f"[STORAGE] DATA_DIR writable: {os.access(DATA_DIR, os.W_OK)}")
    
    points = get_points()
    points.append(point)
    print(f"[STORAGE] Total points after append: {len(points)}")
    
    # Атомарное сохранение
    temp_file = FILE + ".tmp"
    try:
        print(f"[STORAGE] Writing to temp file: {temp_file}")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(points, f, ensure_ascii=False, indent=2)
        print(f"[STORAGE] Temp file written successfully")
        
        if os.path.exists(FILE):
            os.replace(temp_file, FILE)
            print(f"[STORAGE] Replaced existing file: {FILE}")
        else:
            os.rename(temp_file, FILE)
            print(f"[STORAGE] Renamed temp to: {FILE}")
        
        print(f"[STORAGE] Point saved successfully!")
        print(f"[STORAGE] File now exists: {os.path.exists(FILE)}")
        print(f"[STORAGE] File size: {os.path.getsize(FILE) if os.path.exists(FILE) else 0} bytes")
        
    except Exception as e:
        print(f"[STORAGE] ERROR saving points file: {e}")
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        raise
def get_user_points(user_id):
    return [p for p in get_points() if p.get("user_id") == user_id]
def get_user_data(user_id):
    users_file = DATA_DIR + "/user_data.json"
    if not os.path.exists(users_file):
        return {"annotations": [], "settings": {}}
    try:
        with open(users_file, "r", encoding="utf-8") as f:
            all_data = json.load(f)
        return all_data.get(user_id, {"annotations": [], "settings": {}})
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading user data file: {e}")
        if os.path.exists(users_file):
            backup_file = users_file + ".backup"
            try:
                os.rename(users_file, backup_file)
                print(f"Corrupted file backed up to {backup_file}")
            except:
                pass
        return {"annotations": [], "settings": {}}

def save_user_data(user_id, data):
    users_file = DATA_DIR + "/user_data.json"
    if not os.path.exists(users_file):
        all_data = {}
    else:
        try:
            with open(users_file, "r", encoding="utf-8") as f:
                all_data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error reading user data file: {e}")
            all_data = {}
    all_data[user_id] = data
    os.makedirs(DATA_DIR, exist_ok=True)
    # Атомарное сохранение
    temp_file = users_file + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        if os.path.exists(users_file):
            os.replace(temp_file, users_file)
        else:
            os.rename(temp_file, users_file)
    except Exception as e:
        print(f"Error saving user data file: {e}")
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        raise
def initialize_test_location():
    pass
def delete_user_point(user_id, point_id):
    points = get_points()
    points = [p for p in points if not (p.get("id") == point_id and p.get("user_id") == user_id)]
    # Атомарное сохранение
    temp_file = FILE + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(points, f, ensure_ascii=False, indent=2)
        if os.path.exists(FILE):
            os.replace(temp_file, FILE)
        else:
            os.rename(temp_file, FILE)
    except Exception as e:
        print(f"Error saving points file: {e}")
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        raise
    return True

def get_all_points():
    return load_points()

def get_point_history(lat, lng):
    points = load_points()
    return [
        p for p in points
        if abs(p.get("lat", 0) - lat) < 0.0001 and abs(p.get("lng", 0) - lng) < 0.0001
    ]
