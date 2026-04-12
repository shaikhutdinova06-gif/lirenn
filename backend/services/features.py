import cv2
import numpy as np

def extract_features(img):
    """Извлекает признаки из изображения почвы"""
    img = cv2.resize(img, (224, 224))
    
    # Цветовые признаки
    mean = img.mean(axis=(0, 1))
    std = img.std(axis=(0, 1))
    
    # Текстурные признаки (очень важно!)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = edges.mean()
    
    # Гистограмма яркости
    hist = cv2.calcHist([gray], [0], None, [16], [0, 256])
    hist = hist.flatten() / hist.sum()
    
    return np.concatenate([mean, std, [edge_density], hist])
