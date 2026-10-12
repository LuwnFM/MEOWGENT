"""Opt-in smoke test. Makes at most one free-model completion request."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "https://openrouter.ai/api/v1"
KEY = os.environ.get("OPENROUTER_API_KEY", "")
REQUESTED = os.environ.get("TEST_MODEL", "").strip()
HEADERS = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def request(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=HEADERS,
                                 method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.load(response)

def main():
    if not KEY:
        print("Missing OPENROUTER_API_KEY", file=sys.stderr)
        return 1
    try:
        catalog = request("/models").get("data", [])
        free = {m["id"] for m in catalog
                if m.get("pricing", {}).get("prompt") is not None
                and m.get("pricing", {}).get("completion") is not None
                and float(m["pricing"]["prompt"]) == 0
                and float(m["pricing"]["completion"]) == 0
                and "text" in m.get("architecture", {}).get("input_modalities", ["text"])}
        preferred = ["z-ai/glm-5.2:free", "openai/gpt-oss-20b:free"]
        model = REQUESTED if REQUESTED else next((m for m in preferred if m in free), None)
        if not model:
            model = next((m for m in sorted(free) if m.endswith(":free")), None)
        if not model or model not in free:
            print("No eligible zero-priced text model found; refusing paid request.")
            return 1
        print(f"Testing zero-priced model: {model}")
        response = request("/chat/completions", {
            "model": model,
            "messages": [{"role": "user", "content": "Reply with the single word OK."}],
            "max_tokens": 24,
            "temperature": 0,
            "stream": False,
        })
        choices = response.get("choices") or []
        message = choices[0].get("message", {}) if choices else {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            print("Request returned no nonempty assistant text; check model response and limits.")
            return 1
        print(f"PASS: nonempty response; provider model: {response.get('model', model)}; characters: {len(content)}")
        return 0
    except urllib.error.HTTPError as exc:
        print(f"OpenRouter returned HTTP {exc.code}; check API key, model availability, quotas and provider status.")
        return 1
    except Exception as exc:
        print(f"Smoke test failed: {type(exc).__name__}: {exc}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
