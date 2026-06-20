import torch.nn as nn
import torchvision.models as models

def get_model(n):
    m = models.resnet18(pretrained=True)
    m.fc = nn.Linear(m.fc.in_features, n)
    return m
