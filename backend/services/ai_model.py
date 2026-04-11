import cv2
import numpy as np
import joblib

MODEL_PATH = "backend/ml/model.pkl"
model = None

def load_model():
    global model
    if model is None:
        model = joblib.load(MODEL_PATH)

def extract_features(img):
    img = cv2.resize(img, (100,100))
    mean = img.mean(axis=(0,1))
    std = img.std(axis=(0,1))
    return np.concatenate([mean, std])

def predict(file):
    load_model()

    contents = file.file.read()
    npimg = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    feats = extract_features(img)

    pred = model.predict([feats])[0]
    prob = max(model.predict_proba([feats])[0])

    return pred, float(prob)
