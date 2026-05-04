import json
import os
import uuid
import shutil
from datetime import datetime

# Используем /data для Docker/Amvera, data для локальной разработки
DATA_DIR = os.getenv("DATA_DIR", "/data")
DATA_FILE = DATA_DIR + "/points.json"
FILE = DATA_FILE

# Множественные резервные копии
BACKUP_DIR = DATA_DIR + "/backups"
BACKUP1 = BACKUP_DIR + "/points_backup1.json"
BACKUP2 = BACKUP_DIR + "/points_backup2.json"
BACKUP3 = BACKUP_DIR + "/points_backup3.json"

print(f"[STORAGE] Initializing enhanced storage...")
print(f"[STORAGE] DATA_DIR: {DATA_DIR}")
print(f"[STORAGE] DATA_FILE: {DATA_FILE}")
print(f"[STORAGE] BACKUP_DIR: {BACKUP_DIR}")
print(f"[STORAGE] Current working directory: {os.getcwd()}")

# Создаем все необходимые директории
try:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    print(f"[STORAGE] Directories created/verified")
    print(f"[STORAGE] DATA_DIR exists: {os.path.exists(DATA_DIR)}")
    print(f"[STORAGE] BACKUP_DIR exists: {os.path.exists(BACKUP_DIR)}")
    print(f"[STORAGE] DATA_DIR writable: {os.access(DATA_DIR, os.W_OK)}")
    print(f"[STORAGE] BACKUP_DIR writable: {os.access(BACKUP_DIR, os.W_OK)}")
except Exception as e:
    print(f"[STORAGE] ERROR creating directories: {e}")

def startup_recovery():
    """Восстановление данных при запуске приложения"""
    print("[STORAGE] Starting startup recovery...")
    
    # Проверяем основной файл
    if os.path.exists(FILE):
        try:
            with open(FILE, "r", encoding="utf-8") as f:
                points = json.load(f)
            print(f"[STORAGE] Main file OK: {len(points)} points")
            return points
        except Exception as e:
            print(f"[STORAGE] Main file corrupted: {e}")
    
    # Пробуем восстановить из резервных копий в обратном порядке
    for backup_file, name in [(BACKUP3, "Backup3"), (BACKUP2, "Backup2"), (BACKUP1, "Backup1")]:
        if os.path.exists(backup_file):
            try:
                with open(backup_file, "r", encoding="utf-8") as f:
                    points = json.load(f)
                print(f"[STORAGE] Recovered from {name}: {len(points)} points")
                # Восстанавливаем основной файл
                shutil.copy2(backup_file, FILE)
                print(f"[STORAGE] Main file restored from {name}")
                return points
            except Exception as e:
                print(f"[STORAGE] {name} corrupted: {e}")
                continue
    
    print("[STORAGE] No valid backup found, starting fresh")
    return []

# Выполняем восстановление при импорте
startup_points = startup_recovery()

def get_points():
    """Чтение точек с использованием восстановленных данных"""
    global startup_points
    
    # Если есть восстановленные данные при запуске, используем их
    if startup_points is not None:
        points = startup_points
        startup_points = None  # Освобождаем память
        print(f"[STORAGE] Using startup recovery: {len(points)} points")
        return points
    
    # Стандартное чтение
    if not os.path.exists(FILE):
        print(f"[STORAGE] File not found: {FILE}")
        # Пробуем восстановить из backup
        if recover_from_backup():
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
        # Поврежденный файл - пробуем восстановить
        if recover_from_backup():
            print("[STORAGE] Recovered from backup due to corruption")
            try:
                with open(FILE, "r", encoding="utf-8") as f:
                    points = json.load(f)
                    print(f"[STORAGE] Recovery successful: {len(points)} points")
                    return points
            except Exception as e2:
                print(f"[STORAGE] Recovery failed: {e2}")
        else:
            print("[STORAGE] No backup available, starting fresh")
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
    
    points = get_points()
    points.append(point)
    print(f"[STORAGE] Total points after append: {len(points)}")
    
    # Создаем множественные резервные копии
    try:
        # Сдвигаем старые копии
        if os.path.exists(BACKUP2):
            shutil.copy2(BACKUP2, BACKUP3)
            print(f"[STORAGE] Shifted BACKUP2 to BACKUP3")
        if os.path.exists(BACKUP1):
            shutil.copy2(BACKUP1, BACKUP2)
            print(f"[STORAGE] Shifted BACKUP1 to BACKUP2")
        if os.path.exists(FILE):
            shutil.copy2(FILE, BACKUP1)
            print(f"[STORAGE] Shifted main file to BACKUP1")
        
        print(f"[STORAGE] Created multiple backup layers")
    except Exception as e:
        print(f"[STORAGE] Backup rotation failed: {e}")
    
    # Атомарное сохранение
    temp_file = FILE + ".tmp"
    try:
        print(f"[STORAGE] Writing to temp file: {temp_file}")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(points, f, ensure_ascii=False, indent=2)
        print(f"[STORAGE] Temp file written successfully")
        
        if os.path.exists(FILE):
            os.replace(temp_file, FILE)
        else:
            os.rename(temp_file, FILE)
        
        print(f"[STORAGE] Point saved successfully")
        return {"success": True, "message": "Point saved"}
    except Exception as e:
        print(f"[STORAGE] Save failed: {e}")
        # Очищаем временный файл
        try:
            os.remove(temp_file)
        except:
            pass
        return {"error": str(e)}

def recover_from_backup():
    """Восстановление данных из множественных резервных копий"""
    # Пробуем в обратном порядке: BACKUP3 → BACKUP2 → BACKUP1
    for backup_file, name in [(BACKUP3, "Backup3"), (BACKUP2, "Backup2"), (BACKUP1, "Backup1")]:
        if os.path.exists(backup_file):
            try:
                shutil.copy2(backup_file, FILE)
                print(f"[STORAGE] Recovered from {name}: {backup_file}")
                return True
            except Exception as e:
                print(f"[STORAGE] Recovery from {name} failed: {e}")
                continue
    
    print("[STORAGE] No valid backup found for recovery")
    return False

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
            # Создаем резервную копию перед изменением
            backup_file = FILE + ".backup"
            if os.path.exists(FILE):
                try:
                    import shutil
                    shutil.copy2(FILE, backup_file)
                    print(f"[STORAGE] Created backup before measurement update: {backup_file}")
                except Exception as e:
                    print(f"[STORAGE] Backup failed: {e}")
            
            # Инициализируем историю измерений если её нет
            if "measurements" not in point:
                point["measurements"] = []
            
            # Добавляем новое измерение с датой
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
            
            # Сохраняем обновленные точки
            os.makedirs(DATA_DIR, exist_ok=True)
            temp_file = FILE + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(points, f, ensure_ascii=False, indent=2)
            if os.path.exists(FILE):
                os.replace(temp_file, FILE)
            else:
                os.rename(temp_file, FILE)
            
            print(f"[STORAGE] Measurement added successfully. Total measurements: {len(point['measurements'])}")
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
