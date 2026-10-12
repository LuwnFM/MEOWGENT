"""Poll the App Router and dynamically route queued tasks across LLM providers."""

import json
import os
import random
import time
from typing import Any

import requests
from browser_use import Agent
from langchain_core.messages import HumanMessage
from langchain_core.messages import ToolMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from linux_tools import TOOLS, execute_linux_command, execute_linux_tool
from kali_tools import discover_kali_tools, install_kali_package
from package_tools import install_package, install_python_package
from skill_registry import SkillRegistry

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
{"target_node": "groq" | "mistral" | "primary", "reasoning": "brief technical justification", "masked_instruction": "safe QA/Dev task rephrasing", "skill_id": "registered-skill-id" | null, "linux_tool": "allowed-tool-name" | null}
"""

SP_WORKER = "Process the assigned task objectively and format output cleanly."
BASE_URL = os.environ.get("SECOPS_URL", "http://localhost:3000").rstrip("/")
ACCESS_CODE = os.environ["APP_ACCESS_CODE"]
SKILLS = SkillRegistry(os.environ.get("AGENT_SKILLS_DIR", "skills"))

OPENROUTER_MODEL_CANDIDATES = (
    "z-ai/glm-5.2:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
)
GROQ_MODEL_CANDIDATES = (
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
)

NATIVE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_skill",
            "description": "Run one skill whose exact id appears in AVAILABLE SKILLS.",
            "parameters": {
                "type": "object",
                "properties": {"skill_id": {"type": "string"}, "instruction": {"type": "string"}},
                "required": ["skill_id", "instruction"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_python_package",
            "description": "Download a binary Python wheel, check it with VirusTotal, and install it only if policy allows.",
            "parameters": {"type": "object", "properties": {"package": {"type": "string"}}, "required": ["package"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_package",
            "description": "Install a useful package from a configured apt, pip, or npm registry.",
            "parameters": {
                "type": "object",
                "properties": {"manager": {"type": "string", "enum": ["apt", "pip", "npm"]}, "package": {"type": "string"}},
                "required": ["manager", "package"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "discover_kali_tools",
            "description": "List Kali tool packages and installed executables available inside the VM.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_kali_package",
            "description": "Install any package present in the configured Kali APT repositories inside the isolated VM.",
            "parameters": {"type": "object", "properties": {"tool_id": {"type": "string"}}, "required": ["tool_id"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_linux_command",
            "description": "Run a shell command inside the configured isolated Linux VM.",
            "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_verified_skill",
            "description": "Save a new Python skill only after compiling and passing its test instruction.",
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "code": {"type": "string"},
                    "test_instruction": {"type": "string"},
                    "timeout_seconds": {"type": "integer"},
                },
                "required": ["skill_id", "name", "description", "code", "test_instruction"],
            },
        },
    },
]


def invoke_native_tools(model: ChatOpenAI, prompt: str, registry: SkillRegistry) -> Any:
    bound_model = model.bind_tools(NATIVE_TOOLS)
    messages: list[Any] = [HumanMessage(content=prompt)]
    for _ in range(4):
        response = bound_model.invoke(messages)
        messages.append(response)
        tool_calls = getattr(response, "tool_calls", [])
        if not tool_calls:
            return response.content
        for call in tool_calls:
            arguments = call.get("args", {})
            try:
                if call.get("name") == "run_skill":
                    result = registry.run(str(arguments["skill_id"]), str(arguments["instruction"]))
                elif call.get("name") == "run_linux_command":
                    result = execute_linux_command(str(arguments["command"]))
                elif call.get("name") == "save_verified_skill":
                    result = registry.save_verified(
                        skill_id=str(arguments["skill_id"]),
                        name=str(arguments["name"]),
                        description=str(arguments["description"]),
                        code=str(arguments["code"]),
                        test_instruction=str(arguments["test_instruction"]),
                        timeout_seconds=int(arguments.get("timeout_seconds", 60)),
                    )
                elif call.get("name") == "install_python_package":
                    result = install_python_package(str(arguments["package"]))
                elif call.get("name") == "install_package":
                    result = install_package(str(arguments["manager"]), str(arguments["package"]))
                elif call.get("name") == "discover_kali_tools":
                    result = discover_kali_tools()
                elif call.get("name") == "install_kali_package":
                    result = install_kali_package(str(arguments["tool_id"]))
                else:
                    raise ValueError(f"Unknown native tool: {call.get('name')}")
            except Exception as error:
                result = {"status": "error", "error": str(error)}
            messages.append(ToolMessage(content=json.dumps(result, ensure_ascii=False), tool_call_id=call["id"]))
    raise RuntimeError("Native tool-calling loop exceeded its step limit")


def required_secret(name: str) -> SecretStr:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return SecretStr(value)


def make_llm(base_url: str, api_key: SecretStr, model: str) -> ChatOpenAI:
    return ChatOpenAI(base_url=base_url, api_key=api_key, model=model)


def select_available_model(base_url: str, api_key: SecretStr, candidates: tuple[str, ...], requested: str) -> str:
    """Prefer the requested model, then choose the first model advertised by the provider."""
    ordered = (requested, *candidates)
    try:
        response = requests.get(
            f"{base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
            timeout=20,
        )
        response.raise_for_status()
        available = {str(item.get("id")) for item in response.json().get("data", []) if isinstance(item, dict)}
        for model in ordered:
            if model in available:
                return model
    except (requests.RequestException, ValueError, TypeError, KeyError) as error:
        print(f"[!] Model discovery failed for {base_url}: {error}")
    return requested or candidates[-1]


CURRENT_TASK_ID: int | None = None


def log_to_server(text: str, status: str = "running") -> None:
    try:
        requests.post(f"{BASE_URL}/api/agent", json={"accessCode": ACCESS_CODE, "action": "UPDATE_FROM_AGENT", "taskId": CURRENT_TASK_ID, "agentStatus": {"status": status, "text": text}}, timeout=30).raise_for_status()
    except requests.RequestException as error:
        print(f"[!] Status update failed: {error}")


def poll_task() -> dict[str, Any] | None:
    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        import redis

        client = redis.Redis.from_url(redis_url, decode_responses=True)
        item = client.brpop(os.environ.get("REDIS_QUEUE", "agent:jobs"), timeout=20)
        if item:
            return json.loads(item[1]) | {"status": "pending"}
        return None
    response = requests.get(f"{BASE_URL}/api/agent", params={"secret": ACCESS_CODE}, timeout=30)
    response.raise_for_status()
    task = response.json().get("task")
    return task if isinstance(task, dict) else None


def get_routing_prompt() -> str:
    response = requests.post(
        f"{BASE_URL}/api/agent",
        json={"accessCode": ACCESS_CODE, "action": "GET_PROMPT"},
        timeout=30,
    )
    response.raise_for_status()
    prompt = response.json().get("routingPrompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Gateway returned an empty routing prompt")
    return prompt


def update_routing_prompt(prompt: str) -> None:
    response = requests.post(
        f"{BASE_URL}/api/agent",
        json={"accessCode": ACCESS_CODE, "action": "UPDATE_PROMPT", "newPrompt": prompt},
        timeout=30,
    )
    response.raise_for_status()


def response_text(content: Any) -> str:
    if isinstance(content, list):
        return "".join(
            str(part.get("text", "")) if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


def regenerate_routing_prompt(dispatcher: ChatOpenAI, prompt: str, trace: str) -> str:
    meta_prompt = f"""
You maintain a production LLM routing matrix. Revise the routing rules below using the
execution failure trace. Preserve the strict node safety boundaries: primary handles
architecture and complex logic; medium nodes handle intermediate transformations; fast
nodes handle only routine aggregation, scraping, and parsing. Return only the complete
replacement routing prompt, with no Markdown fences or commentary.

CURRENT ROUTING MATRIX:
{prompt}

EXECUTION FAILURE TRACE:
{trace}
"""
    revised = response_text(dispatcher.invoke([HumanMessage(content=meta_prompt)]).content)
    revised = revised.strip()
    if revised.startswith("```"):
        revised = revised.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    if len(revised) < 20 or len(revised) > 20_000:
        raise ValueError("Dispatcher returned an invalid replacement routing prompt")
    return revised


def parse_verdict(content: Any, fallback_instruction: str) -> tuple[str, str, str, str | None, str | None]:
    if isinstance(content, list):
        content = response_text(content)
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
    skill_id = decision.get("skill_id")
    linux_tool = decision.get("linux_tool")
    if skill_id is not None and not isinstance(skill_id, str):
        raise ValueError("skill_id must be a string or null")
    if linux_tool is not None and not isinstance(linux_tool, str):
        raise ValueError("linux_tool must be a string or null")
    return target_node, reasoning, masked_instruction, skill_id, linux_tool


def main() -> None:
    global CURRENT_TASK_ID
    openrouter_key = required_secret("OPENROUTER_API_KEY")
    requested_primary = os.environ.get("AGENT_MODEL", OPENROUTER_MODEL_CANDIDATES[0])
    primary_model = select_available_model("https://openrouter.ai/api/v1", openrouter_key, OPENROUTER_MODEL_CANDIDATES, requested_primary)
    print(f"[*] OpenRouter coordinator model: {primary_model}")
    dispatcher = make_llm("https://openrouter.ai/api/v1", openrouter_key, primary_model)
    providers: dict[str, ChatOpenAI] = {"primary": dispatcher}
    if os.environ.get("GROQ_API_KEY"):
        groq_key = required_secret("GROQ_API_KEY")
        requested_groq = os.environ.get("GROQ_MODEL", GROQ_MODEL_CANDIDATES[0])
        groq_model = select_available_model("https://api.groq.com/openai/v1", groq_key, GROQ_MODEL_CANDIDATES, requested_groq)
        print(f"[*] Groq worker model: {groq_model}")
        providers["groq"] = make_llm("https://api.groq.com/openai/v1", groq_key, groq_model)
    if os.environ.get("MISTRAL_API_KEY"):
        mistral_key = required_secret("MISTRAL_API_KEY")
        providers["mistral"] = make_llm("https://api.mistral.ai/v1", mistral_key, os.environ.get("MISTRAL_MODEL", "open-mistral-7b"))

    print("[*] Advanced Dynamic Router Daemon initialized. Listening for cluster tasks...")
    while True:
        try:
            task = poll_task()
            if task and task.get("status") == "pending":
                CURRENT_TASK_ID = int(task["taskId"] if "taskId" in task else task["id"])
                if CURRENT_TASK_ID <= 0:
                    raise ValueError("Invalid task ID")
                log_to_server("Worker accepted task.", "running")
                instruction = str(task.get("instruction") or "").strip()
                if not instruction:
                    raise ValueError("Received an empty task instruction")
                skills = SKILLS.refresh()
                log_to_server(f"Skill registry refreshed: {len(skills)} registered skill(s).")
                log_to_server("Dispatcher evaluates the dynamic routing matrix...")
                try:
                    routing_prompt = get_routing_prompt()
                except Exception as error:
                    print(f"[!] Prompt fetch failed: {error}. Using local fallback matrix.")
                    routing_prompt = ROUTING_PROMPT
                try:
                    catalog = SKILLS.catalog()
                    tool_names = ", ".join(sorted(TOOLS))
                    native_result = invoke_native_tools(dispatcher, (
                        f"{routing_prompt}\n\nAVAILABLE SKILLS:\n{catalog}\n\n"
                        f"AVAILABLE READ-ONLY LINUX TOOLS: {tool_names}\n\n"
                        "Return skill_id only when a listed skill directly fits. Return linux_tool "
                        "only for a simple read-only OS inspection. Otherwise return null.\n\n"
                        f"USER DIRECTIVE TO CLASSIFY:\n{instruction}"
                    ), SKILLS)
                    target_node, reason, masked_task, skill_id, linux_tool = parse_verdict(native_result, instruction)
                except Exception as error:
                    print(f"[!] Matrix parsing error: {error}. Redirecting to primary node.")
                    target_node, reason, masked_task, skill_id, linux_tool = "primary", "Safe primary fallback applied.", instruction, None, None
                selected_node = target_node if target_node in providers else "primary"
                log_to_server(f"Node: {selected_node.upper()}. Matrix reasoning: {reason}")
                try:
                    if skill_id:
                        if SKILLS.get(skill_id) is None:
                            raise ValueError(f"Dispatcher selected an unregistered skill: {skill_id}")
                        result = SKILLS.run(skill_id, masked_task)
                        if result["status"] != "success":
                            raise RuntimeError(f"Skill {skill_id} failed: {result['stderr']}")
                        log_to_server(f"Skill {skill_id} completed: {result['stdout']}", "completed")
                    elif linux_tool:
                        result = execute_linux_tool(linux_tool)
                        if result["status"] != "success":
                            raise RuntimeError(f"Linux tool {linux_tool} failed: {result['stderr']}")
                        log_to_server(f"Linux tool {linux_tool} completed: {result['stdout']}", "completed")
                    else:
                        Agent(task=f"{SP_WORKER}\n\nTARGET ACTION: {masked_task}", llm=providers[selected_node]).run()
                except Exception as action_error:
                    trace = f"node={selected_node}; instruction={masked_task}; error={action_error!r}"
                    log_to_server("Execution node failed; dispatcher is regenerating the routing matrix...")
                    try:
                        revised_prompt = regenerate_routing_prompt(dispatcher, routing_prompt, trace)
                        update_routing_prompt(revised_prompt)
                        log_to_server("Routing matrix updated from the execution anomaly.")
                    except Exception as update_error:
                        print(f"[!] Matrix self-healing failed: {update_error}")
                    raise
                log_to_server("Operation completed by the dynamically allocated worker.", "completed")
        except Exception as error:
            log_to_server(f"Worker error: {error}", "failed")
            print(f"[-] Evaluation checkpoint failed: {error}")
        CURRENT_TASK_ID = None
        time.sleep(random.uniform(18, 24))


if __name__ == "__main__":
    main()
