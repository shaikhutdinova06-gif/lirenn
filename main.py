from fastapi import FastAPI

print("🔥 STARTED")

app = FastAPI()

@app.get("/")
def root():
    return {"status": "OK"}

@app.get("/health")
def health():
    return {"status": "healthy"}
