import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib

def generate_synthetic_data(n_samples=1000):
    """Генерирует синтетические данные на основе научных правил цветов (23 фичи как в features.py)"""
    
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
            # Цветовые признаки (mean и std для R, G, B)
            noise_mean = np.random.normal(0, 20, 3)
            mean = np.clip(base_color + noise_mean, 0, 255)
            
            noise_std = np.random.normal(0, 10, 3)
            std = np.clip(noise_std, 0, 100)
            
            # Текстурный признак (edge density)
            edge_density = np.random.uniform(10, 50)
            
            # Гистограмма яркости (16 бинов)
            hist = np.random.dirichlet(np.ones(16)) * 100  # нормализованная гистограмма
            
            # Фичи: [R_mean, G_mean, B_mean, R_std, G_std, B_std, edge_density, hist(16)] = 23 фичи
            features = np.concatenate([mean, std, [edge_density], hist])
            
            X.append(features)
            y.append(soil_type)
    
    return np.array(X), np.array(y)

def train_model():
    """Обучает модель на синтетических данных"""
    
    print("Генерация синтетических данных...")
    X, y = generate_synthetic_data(n_samples=200)
    
    print(f"Обучение модели на {len(X)} примерах с {X.shape[1]} фичами...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    
    print("Сохранение модели...")
    joblib.dump(model, "backend/ml/model.pkl")
    
    print("✅ Модель обучена и сохранена!")
    print(f"Классы: {model.classes_}")
    print(f"Количество фич: {X.shape[1]}")

if __name__ == "__main__":
    train_model()
