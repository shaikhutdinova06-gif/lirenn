import torch
from PIL import Image
import torchvision.transforms as transforms
from ml.model import get_model

classes = ["chernozem","podzol","sand","clay"]

model = get_model(len(classes))
model.load_state_dict(torch.load("ml/soil_model.pth"))
model.eval()

transform = transforms.Compose([
    transforms.Resize((128,128)),
    transforms.ToTensor()
])

def predict(path):

    img = Image.open(path)
    img = transform(img).unsqueeze(0)

    with torch.no_grad():
        out = model(img)

    return classes[out.argmax().item()]
