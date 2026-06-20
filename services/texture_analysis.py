import cv2

def analyze_texture(path):

    img = cv2.imread(path, 0)
    edges = cv2.Canny(img, 50, 150)
    d = edges.mean()

    if d < 5:
        return "гладкая"
    elif d > 20:
        return "зернистая"
    return "смешанная"
