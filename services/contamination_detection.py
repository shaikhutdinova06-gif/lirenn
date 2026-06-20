import cv2
import numpy as np

def detect_contamination(path):

    img = cv2.imread(path)
    img = cv2.resize(img, (256,256))

    pixels = img.reshape((-1,3))
    pixels = np.float32(pixels)

    _, labels, centers = cv2.kmeans(
        pixels, 3, None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,10,1.0),
        10,
        cv2.KMEANS_RANDOM_CENTERS
    )

    mean = np.mean(centers, axis=0)
    dist = [np.linalg.norm(c-mean) for c in centers]

    cluster = np.argmax(dist)

    ratio = (labels.flatten()==cluster).sum()/len(labels)

    if ratio > 0.3:
        return "загрязнение"
    return "чисто"
