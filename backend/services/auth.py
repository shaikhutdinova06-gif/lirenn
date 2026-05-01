from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import os

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Используем /data для Docker/Amvera, data для локальной разработки
DATA_DIR = os.getenv("DATA_DIR", "/data")
# Принудительно исправляем путь для Amvera
if os.path.exists("/app"):
    DATA_DIR = "/data"
USERS_FILE = DATA_DIR + "/users.json"
print(f"Using USERS_FILE: {USERS_FILE}")

def get_users():
    if not os.path.exists(USERS_FILE):
        save_users({})
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading users file: {e}")
        # Создаем резервную копию поврежденного файла
        if os.path.exists(USERS_FILE):
            backup_file = USERS_FILE + ".backup"
            try:
                os.rename(USERS_FILE, backup_file)
                print(f"Corrupted file backed up to {backup_file}")
            except:
                pass
        save_users({})
        return {}

def save_users(users):
    os.makedirs(DATA_DIR, exist_ok=True)
    # Атомарное сохранение через временный файл
    temp_file = USERS_FILE + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        # Атомарное переименование
        if os.path.exists(USERS_FILE):
            os.replace(temp_file, USERS_FILE)
        else:
            os.rename(temp_file, USERS_FILE)
    except Exception as e:
        print(f"Error saving users file: {e}")
        # Удаляем временный файл если что-то пошло не так
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        raise

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def register_user(username: str, password: str):
    users = get_users()
    if username in users:
        return {"error": "User already exists"}
    
    users[username] = {
        "username": username,
        "hashed_password": get_password_hash(password),
        "created_at": datetime.utcnow().isoformat()
    }
    save_users(users)
    print(f"User {username} registered successfully")
    return {"status": "ok", "message": "User registered successfully"}

def authenticate_user(username: str, password: str):
    users = get_users()
    print(f"Authenticating user: {username}, total users: {len(users)}")
    print(f"Available users: {list(users.keys())}")
    print(f"Users file path: {USERS_FILE}")
    
    user = users.get(username)
    if not user:
        print(f"User {username} not found")
        return False
    
    print(f"User found: {username}")
    print(f"Hashed password exists: {'hashed_password' in user}")
    
    if not verify_password(password, user["hashed_password"]):
        print(f"Password verification failed for {username}")
        print(f"Input password length: {len(password)}")
        print(f"Stored hash: {user['hashed_password'][:50]}...")
        return False
    
    print(f"Authentication successful for {username}")
    return user

def get_current_user(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    
    users = get_users()
    user = users.get(username)
    return user
