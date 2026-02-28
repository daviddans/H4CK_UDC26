import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/src
PROJECT_DIR = os.path.dirname(BASE_DIR)                # backend

MODEL_NAME = os.getenv("EMBED_MODEL", "intfloat/multilingual-e5-small")
DEVICE = os.getenv("DEVICE", "cpu")  # "cuda" o "cpu"

DATA_PATH = os.path.join(PROJECT_DIR, "data", "mock_chunks.json")

ARTIFACTS_DIR = os.path.join(PROJECT_DIR, "artifacts")
EMBEDS_PATH = os.path.join(ARTIFACTS_DIR, "chunk_embeds.npy")
META_PATH = os.path.join(ARTIFACTS_DIR, "chunk_meta.json")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")