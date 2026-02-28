from sentence_transformers import SentenceTransformer
from config import MODEL_NAME, DEVICE

_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME, device=DEVICE)
    return _model