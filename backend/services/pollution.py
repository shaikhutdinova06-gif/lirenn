import cv2
import numpy as np

def detect_pollution(img):
    """Детекция загрязнений по цвету и текстуре"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Аномалии (резкие контрасты)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = edges.mean()
    
    # Странные цвета (не почвенные)
    mean_color = img.mean(axis=(0, 1))
    
    # Химические загрязнения (резкие красные/жёлтые пятна)
    if mean_color[2] > 180 and mean_color[1] < 100:
        return "chemical_possible"
    
    # Масляные/нефтяные пятна (тёмные с блеском)
    if mean_color[0] < 50 and mean_color[1] < 50 and mean_color[2] < 50:
        if edge_density > 30:
            return "oil_possible"
    
    # Мусор/обломки (высокая контрастность)
    if edge_density > 50:
        return "debris_or_pollution"
    
    return "clean"
