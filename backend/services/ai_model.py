import cv2
import numpy as np
import joblib
from backend.services.features import extract_features
from backend.services.soil_rules import match_color, get_confidence

MODEL_PATH = "backend/ml/model.pkl"
model = None

def load_model():
    """Загружает модель если она существует"""
    global model
    if model is None:
        try:
            model = joblib.load(MODEL_PATH)
        except:
            model = None
    return model

def predict(file):
    """Предсказание типа почвы (без обучения)"""
    contents = file.file.read()
    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    
    feats = extract_features(img)
    avg_color = feats[:3]
    
    # Если есть обученная модель - используем её
    if load_model():
        pred = model.predict([feats])[0]
        prob = max(model.predict_proba([feats])[0])
        return pred, float(prob)
    
    # Иначе используем правила по цвету (fallback)
    soil = match_color(avg_color)
    confidence = get_confidence(avg_color, soil)
    
    return soil, confidence
