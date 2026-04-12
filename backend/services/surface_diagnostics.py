import cv2
import numpy as np

# Поверхностные диагностические признаки из научного определителя
SURFACE_FEATURES = {
    "salt_crust": {
        "color_range": (200, 255),
        "texture": "crust",
        "priority": "critical",
        "diagnosis": "Солончак"
    },
    "dark_humus": {
        "color_range": (0, 80),
        "texture": "grainy",
        "priority": "high",
        "diagnosis": "Чернозем"
    },
    "gray_humus": {
        "color_range": (100, 160),
        "texture": "lumpy",
        "priority": "high",
        "diagnosis": "Дерново-подзолистая"
    },
    "light_humus": {
        "color_range": (170, 220),
        "texture": "weak",
        "priority": "high",
        "diagnosis": "Каштановая"
    },
    "peat": {
        "color_range": (80, 120),
        "texture": "fibrous",
        "priority": "high",
        "diagnosis": "Торфяная"
    },
    "chemical_pollution": {
        "color_range": "anomaly",
        "texture": "any",
        "priority": "critical",
        "diagnosis": "Хемозем"
    }
}

def detect_surface_features(img):
    """Детекция поверхностных признаков"""
    
    # Средний цвет
    avg_color = img.mean()
    
    # Текстура (гранулярность)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = edges.mean()
    
    # Аномалии (резкие контрасты)
    std = img.std()
    
    detected = []
    
    # Проверяем каждый тип поверхности
    for feature_name, feature_data in SURFACE_FEATURES.items():
        color_range = feature_data["color_range"]
        
        if color_range == "anomaly":
            # Химическое загрязнение - аномальные цвета
            if std > 60:
                detected.append({
                    "feature": feature_name,
                    "diagnosis": feature_data["diagnosis"],
                    "priority": feature_data["priority"],
                    "confidence": 0.8
                })
        else:
            min_c, max_c = color_range
            if min_c <= avg_color <= max_c:
                detected.append({
                    "feature": feature_name,
                    "diagnosis": feature_data["diagnosis"],
                    "priority": feature_data["priority"],
                    "confidence": 0.7
                })
    
    # Если ничего не найдено - возвращаем базовый тип
    if not detected:
        return [{
            "feature": "unknown",
            "diagnosis": "Неизвестно",
            "priority": "low",
            "confidence": 0.3
        }]
    
    # Сортируем по приоритету
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    detected.sort(key=lambda x: priority_order.get(x["priority"], 99))
    
    return detected

def get_surface_diagnosis(img):
    """Получает диагноз по поверхности"""
    features = detect_surface_features(img)
    
    if features:
        return features[0]["diagnosis"], features[0]["confidence"]
    
    return "Неизвестно", 0.3
