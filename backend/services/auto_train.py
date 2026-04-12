import os
import uuid

DATASET_AUTO = "dataset_auto"

def save_for_training(file, label):
    """Сохраняет изображение для автообучения"""
    folder = os.path.join(DATASET_AUTO, label)
    os.makedirs(folder, exist_ok=True)
    
    filename = f"{uuid.uuid4()}.jpg"
    
    with open(os.path.join(folder, filename), "wb") as f:
        f.write(file.file.read())
    
    return filename

def get_auto_train_stats():
    """Возвращает статистику автообучения"""
    stats = {}
    
    if not os.path.exists(DATASET_AUTO):
        return stats
    
    for label in os.listdir(DATASET_AUTO):
        folder = os.path.join(DATASET_AUTO, label)
        if os.path.isdir(folder):
            stats[label] = len(os.listdir(folder))
    
    return stats
