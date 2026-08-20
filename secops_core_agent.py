"""Poll the SecOps App Router endpoint and execute queued browser tasks."""

import os
import time
from typing import Any

import requests
from browser_use import Agent
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

SYSTEM_PROMPT = (
    "You are an industrial web automation and resource monitoring assistant. "
    "Process multi-step actions sequentially and maintain a technical tone."
)
BASE_URL = os.environ.get("SECOPS_URL", "http://localhost:3000")
ACCESS_CODE = os.environ["APP_ACCESS_CODE"]
OPENROUTER_KEY = os.environ["OPENROUTER_API_KEY"]


def update_task(status: str, text: str) -> None:
    requests.post(
        f"{BASE_URL}/api/agent",
        json={
            "accessCode": ACCESS_CODE,
            "action": "UPDATE_FROM_AGENT",
            "agentStatus": {"status": status, "text": text},
        },
        timeout=30,
    ).raise_for_status()


def poll_task() -> dict[str, Any] | None:
    response = requests.get(
        f"{BASE_URL}/api/agent", params={"secret": ACCESS_CODE}, timeout=30
    )
    response.raise_for_status()
    task = response.json().get("task")
    return task if isinstance(task, dict) else None


def main() -> None:
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=SecretStr(OPENROUTER_KEY),
        model=os.environ.get("AGENT_MODEL", "qwen/qwen-2.5-72b-instruct"),
    )
    print("[*] Worker active. Polling App Router API...")

    while True:
        try:
            task = poll_task()
            if task and task.get("status") == "pending":
                instruction = str(task.get("instruction", ""))
                update_task("running", "Task running...")
                Agent(task=f"{SYSTEM_PROMPT}\n\nTASK: {instruction}", llm=llm).run()
                update_task("completed", "Done")
        except Exception as error:
            print(f"[!] Worker error: {error}")
        time.sleep(25)


if __name__ == "__main__":
    main()
