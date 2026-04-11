import os
import cv2
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib

DATASET = "dataset"

def extract_features(img):
    img = cv2.resize(img, (100,100))
    mean = img.mean(axis=(0,1))
    std = img.std(axis=(0,1))
    return np.concatenate([mean, std])

X, y = [], []

for label in os.listdir(DATASET):
    path = os.path.join(DATASET, label)

    for file in os.listdir(path):
        img = cv2.imread(os.path.join(path, file))
        if img is None:
            continue

        X.append(extract_features(img))
        y.append(label)

model = RandomForestClassifier(n_estimators=100)
model.fit(X, y)

joblib.dump(model, "backend/ml/model.pkl")

print("Model trained!")
