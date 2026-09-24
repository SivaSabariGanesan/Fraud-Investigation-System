import httpx
import json

def main():
    urls = [
        "http://localhost:11434/api/tags",
        "http://127.0.0.1:11434/api/tags",
        "http://host.docker.internal:11434/api/tags"
    ]
    for url in urls:
        try:
            r = httpx.get(url, timeout=3.0)
            if r.status_code == 200:
                print(f"Ollama connected successfully at {url}!")
                models = r.json().get("models", [])
                print(f"Available models ({len(models)}):")
                for m in models:
                    print(f" - {m.get('name')}")
                return
        except Exception as e:
            print(f"Could not connect to {url}: {e}")

if __name__ == "__main__":
    main()
