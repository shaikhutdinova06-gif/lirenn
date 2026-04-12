import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib

def generate_synthetic_data(n_samples=1000):
    """Генерирует синтетические данные на основе научных правил цветов"""
    
    # Правила цветов из soil_rules.py
    SOIL_COLORS = {
        "chernozem": np.array([60, 60, 60]),
        "podzolic": np.array([200, 200, 200]),
        "gray_forest": np.array([138, 138, 138]),
        "gley": np.array([169, 178, 195]),
        "chestnut": np.array([180, 140, 100]),
        "tundra_gley": np.array([120, 130, 140])
    }
    
    X = []
    y = []
    
    for soil_type, base_color in SOIL_COLORS.items():
        for _ in range(n_samples):
            # Добавляем шум к базовому цвету
            noise = np.random.normal(0, 20, 3)
            color = np.clip(base_color + noise, 0, 255)
            
            # Добавляем текстуру (edge density)
            edge_density = np.random.uniform(10, 50)
            
            # Фичи: [R, G, B, edge_density]
            features = np.concatenate([color, [edge_density]])
            
            X.append(features)
            y.append(soil_type)
    
    return np.array(X), np.array(y)

def train_model():
    """Обучает модель на синтетических данных"""
    
    print("Генерация синтетических данных...")
    X, y = generate_synthetic_data(n_samples=200)
    
    print(f"Обучение модели на {len(X)} примерах...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    
    print("Сохранение модели...")
    joblib.dump(model, "backend/ml/model.pkl")
    
    print("✅ Модель обучена и сохранена!")
    print(f"Классы: {model.classes_}")

if __name__ == "__main__":
    train_model()
