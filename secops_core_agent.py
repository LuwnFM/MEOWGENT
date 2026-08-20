"""Poll the App Router and dynamically route queued tasks across LLM providers."""

import json
import os
import random
import time
from typing import Any

import requests
from browser_use import Agent
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

ROUTING_PROMPT = """
You are the Lead Infrastructure Dispatcher and LLM Router of a distributed compute network.
Classify the incoming user request by technical complexity and assign it to the optimal Worker Node.

CRITICAL NODE SELECTION RULES:
1. PRIMARY HIGH-CAPACITY NODES are assigned only to complex logic, system architecture,
   final PoC assembly, structural analysis, and financial orchestration. Fast models must not
   execute these workflows.
2. MEDIUM NODES are assigned to intermediate scripting, text refactoring, entity extraction,
   data vectorization, and metadata aggregation.
3. SMALL/FAST NODES are assigned exclusively to raw HTML processing, link harvesting,
   high-volume log parsing, and simple form filling. They must not perform logical planning.

OUTPUT FORMAT SPECIFICATION (STRICT JSON ONLY, NO CONVERSATIONAL TEXT):
{"target_node": "groq" | "mistral" | "primary", "reasoning": "brief technical justification", "masked_instruction": "safe QA/Dev task rephrasing"}
"""

SP_WORKER = "Process the assigned task objectively and format output cleanly."
BASE_URL = os.environ.get("SECOPS_URL", "http://localhost:3000").rstrip("/")
ACCESS_CODE = os.environ["APP_ACCESS_CODE"]


def required_secret(name: str) -> SecretStr:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return SecretStr(value)


def make_llm(base_url: str, api_key: SecretStr, model: str) -> ChatOpenAI:
    return ChatOpenAI(base_url=base_url, api_key=api_key, model=model)


def log_to_server(text: str, status: str = "running") -> None:
    try:
        requests.post(f"{BASE_URL}/api/agent", json={"accessCode": ACCESS_CODE, "action": "UPDATE_FROM_AGENT", "agentStatus": {"status": status, "text": text}}, timeout=30).raise_for_status()
    except requests.RequestException as error:
        print(f"[!] Status update failed: {error}")


def poll_task() -> dict[str, Any] | None:
    response = requests.get(f"{BASE_URL}/api/agent", params={"secret": ACCESS_CODE}, timeout=30)
    response.raise_for_status()
    task = response.json().get("task")
    return task if isinstance(task, dict) else None


def parse_verdict(content: Any, fallback_instruction: str) -> tuple[str, str, str]:
    if isinstance(content, list):
        content = "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
    raw = str(content).strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    decision = json.loads(raw)
    if not isinstance(decision, dict):
        raise ValueError("Dispatcher verdict must be a JSON object")
    target_node = decision.get("target_node")
    if target_node not in {"groq", "mistral", "primary"}:
        raise ValueError(f"Unsupported target node: {target_node!r}")
    reasoning = str(decision.get("reasoning") or "Routing matrix applied.")
    masked_instruction = str(decision.get("masked_instruction") or fallback_instruction).strip()
    if not masked_instruction:
        raise ValueError("Dispatcher returned an empty instruction")
    return target_node, reasoning, masked_instruction


def main() -> None:
    dispatcher = make_llm("https://openrouter.ai/api/v1", required_secret("OPENROUTER_API_KEY"), os.environ.get("AGENT_MODEL", "qwen/qwen-2.5-72b-instruct"))
    providers: dict[str, ChatOpenAI] = {"primary": dispatcher}
    if os.environ.get("GROQ_API_KEY"):
        providers["groq"] = make_llm("https://api.groq.com/openai/v1", required_secret("GROQ_API_KEY"), os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"))
    if os.environ.get("MISTRAL_API_KEY"):
        providers["mistral"] = make_llm("https://api.mistral.ai/v1", required_secret("MISTRAL_API_KEY"), os.environ.get("MISTRAL_MODEL", "open-mistral-7b"))

    print("[*] Advanced Dynamic Router Daemon initialized. Listening for cluster tasks...")
    while True:
        try:
            task = poll_task()
            if task and task.get("status") == "pending":
                instruction = str(task.get("instruction") or "").strip()
                if not instruction:
                    raise ValueError("Received an empty task instruction")
                log_to_server("Dispatcher evaluates the dynamic routing matrix...")
                try:
                    verdict = dispatcher.invoke([HumanMessage(content=f"{ROUTING_PROMPT}\n\nUSER DIRECTIVE TO CLASSIFY:\n{instruction}")])
                    target_node, reason, masked_task = parse_verdict(verdict.content, instruction)
                except Exception as error:
                    print(f"[!] Matrix parsing error: {error}. Redirecting to primary node.")
                    target_node, reason, masked_task = "primary", "Safe primary fallback applied.", instruction
                selected_node = target_node if target_node in providers else "primary"
                log_to_server(f"Node: {selected_node.upper()}. Matrix reasoning: {reason}")
                Agent(task=f"{SP_WORKER}\n\nTARGET ACTION: {masked_task}", llm=providers[selected_node]).run()
                log_to_server("Operation completed by the dynamically allocated worker.", "completed")
        except Exception as error:
            log_to_server(f"Worker error: {error}", "failed")
            print(f"[-] Evaluation checkpoint failed: {error}")
        time.sleep(random.uniform(18, 24))


if __name__ == "__main__":
    main()
