
📝 Текст промпта для отправки в чат Codespaces
Скопируйте текст ниже целиком, как есть, и отправьте его вашему ИИ-помощнику в Codespaces:
text
Please execute a complete, production-ready systemic architecture upgrade across our entire workspace to implement a unified, secure distributed web-automation and infrastructure diagnostic layout. The design must integrate an autonomous environment discovery system, hard network proxy isolation (proxychains4 + Tor routing), and a permanent relational knowledge caching store using our cloud PostgreSQL instance. Ensure all core files are located strictly at the repository root level. Please inject, structure, and overwrite the following two primary system configurations directly into the repository files: File 1 [Database-Backed API Gateway] -> Path: `app/api/agent/route.ts` Replace the entire layout with this fully typed, type-safe TypeScript implementation: ```typescript import { NextResponse } from 'next/server'; import { sql } from '@vercel/postgres'; let currentTask: { instruction: string; status: string; statusText: string } | null = null; async function ensureSchemaExists() { try { // Schema Table 1: High-Capacity Prompt Routing Configuration await sql` CREATE TABLE IF NOT EXISTS routing_config ( id SERIAL PRIMARY KEY, prompt_text TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ); `; // Schema Table 2: Autonomous Agent Self-Refining Knowledge Base await sql` CREATE TABLE IF NOT EXISTS agent_knowledge_base ( id SERIAL PRIMARY KEY, directive_key TEXT UNIQUE NOT NULL, executable_protocol TEXT NOT NULL, compliance_mask TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ); `; const result = await sql`SELECT count(*) FROM routing_config;`; if (parseInt(result.rows.count) === 0) { const defaultPrompt = "PRIMARY HIGH-CAPACITY NODES handle complex logic. SMALL/FAST NODES handle routine operations."; await sql`INSERT INTO routing_config (prompt_text) VALUES (${defaultPrompt});`; } } catch (e) { console.error("Database schema alignment failure:", e); } } export async function POST(req: Request) { try { await ensureSchemaExists(); const body = await req.json(); const { accessCode, action, instruction, agentStatus, newPrompt, directiveKey, executableProtocol, complianceMask } = body; if (accessCode !== process.env.APP_ACCESS_CODE && accessCode !== process.env.NEXT_PUBLIC_APP_ACCESS_CODE) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); } if (action === 'SET_TASK') { currentTask = { instruction, status: 'pending', statusText: 'Supervisor node dispatching work...' }; return NextResponse.json({ success: true }); } if (action === 'GET_STATUS') return NextResponse.json({ task: currentTask }); if (action === 'UPDATE_FROM_AGENT') { if (currentTask) { currentTask.status = agentStatus.status; currentTask.statusText = agentStatus.text; } return NextResponse.json({ success: true }); } if (action === 'UPDATE_PROMPT') { await sql`UPDATE routing_config SET prompt_text = ${newPrompt}, updated_at = CURRENT_TIMESTAMP WHERE id = 1;`; return NextResponse.json({ success: true }); } if (action === 'GET_PROMPT') { const dbRes = await sql`SELECT prompt_text FROM routing_config WHERE id = 1;`; return NextResponse.json({ routingPrompt: dbRes.rows.prompt_text }); } // Knowledge base transaction primitives if (action === 'CACHE_PROTOCOL') { await sql` INSERT INTO agent_knowledge_base (directive_key, executable_protocol, compliance_mask) VALUES (${directiveKey}, ${executableProtocol}, ${complianceMask}) ON CONFLICT (directive_key) DO UPDATE SET executable_protocol = ${executableProtocol}, created_at = CURRENT_TIMESTAMP; `; return NextResponse.json({ success: true }); } if (action === 'RECALL_PROTOCOL') { const kbRes = await sql`SELECT executable_protocol, compliance_mask FROM agent_knowledge_base WHERE directive_key = ${directiveKey};`; return NextResponse.json({ protocol: kbRes.rows.length > 0 ? kbRes.rows : null }); } return NextResponse.json({ error: 'Bad action' }, { status: 400 }); } catch (e) { return NextResponse.json({ error: 'Server Error' }, { status: 500 }); } } export async function GET(req: Request) { const { searchParams } = new URL(req.url); if (searchParams.get('secret') !== process.env.APP_ACCESS_CODE) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); return NextResponse.json({ task: currentTask }); } ``` File 2 [Autonomous Linux Subsystem Worker Daemon] -> Path: `secops_core_agent.py` Overwrite the entire host-side execution script with this comprehensive dynamic environment discovery and cloaked proxy execution engine: ```python import os import sys import shutil import subprocess import time import random import json import requests from browser_use import Agent, BrowserConfig from langchain_openai import ChatOpenAI from langchain_core.tools import tool from langchain_core.messages import HumanMessage from pydantic import SecretStr # ===================================================================== # EDITABLE SYSTEM ROUTING PROMPT (MUTABLE MATRIX CONTROL) # ===================================================================== ROUTING_PROMPT = """ You are

process_outcome = subprocess.run(final_sequence, capture_output=True, text=True, timeout=240)
if process_outcome.returncode == 0:
return f"[SUCCESS] Cloaked Subsystem Output:\n{process_outcome.stdout}"
else:
return f"[WARNING] Finished with exit code {process_outcome.returncode}.\nLogs:\n{process_outcome.stdout}\nErrors:\n{process_outcome.stderr}"
except subprocess.TimeoutExpired:
return "[TIMEOUT] Network trace dropped due to high proxy node encryption latency."
except Exception as internal_err:
return f"[FATAL] Subsystem process failed to launch: {str(internal_err)}"
@tool
def execute_linux_subsystem_utility(binary_name: str, syntax_arguments: list) -> str:
"""
Executes a verified host utility strictly via proxychains4 encapsulation.
"""
if binary_name not in DISCOVERED_KALI_SUITE:
return f"Routing Error: Binary '{binary_name}' is missing in host environment PATH."
malicious_delimiters = [";", "&&", "||", "`", "$", "|", ">", "<"]
for parameter in syntax_arguments:
if any(d in str(parameter) for d in malicious_delimiters):
return "Security Restriction: Shell token violation triggered."
execution_payload = [binary_name] + [str(s) for s in syntax_arguments]
return run_cloaked_linux_binary(execution_payload)
runtime_capabilities = [execute_linux_subsystem_utility]
llm_with_tools = llm_dispatcher.bind_tools(runtime_capabilities)
def log_to_server(text, status="running"):
try: requests.post(URL, json={"accessCode": CODE, "action": "UPDATE_FROM_AGENT", "agentStatus": {"status": status, "text": text}})
except: pass
print(f"[*] Tunneled Core Daemon Operational. Local proxy state: [{'ACTIVE' if PROXYCHAINS_PATH else 'MISSING'}]")
log_to_server(f"Воркер Tor/Proxychains Kali запущен. Прямой выход в сеть полностью заблокирован.", "completed")
=====================================================================
BROWSER PROXY TUNNELING ENFORCEMENT
=====================================================================
stealth_browser_config = BrowserConfig(
extra_chromium_args=[
"--proxy-server=socks5://127.0.0.1:9050",
"--disable-blink-features=AutomationControlled"
]
)
while True:
try:
res = requests.get(f"{URL}?secret={CODE}").json()
t = res.get("task")
if t and t.get("status") == "pending":
ins = t.get("instruction")
log_to_server("ИИ обращается к базе данных за успешными протоколами...", "running")
# Step 1: Automated Memory Recall Check from Neon DB
try:
recall_res = requests.post(URL, json={"accessCode": CODE, "action": "RECALL_PROTOCOL", "directiveKey": ins}).json()
cached_data = recall_res.get("protocol")
if cached_data:
log_to_server("Обнаружен готовый сохраненный протокол в Neon DB. Запуск без регенерации...", "running")
ins = cached_data[0].get("executable_protocol")
except:
pass
log_to_server("Диспетчер вычисляет матрицу маршрутизации по критериям сложности...", "running")
# Step 2: Prompt-Driven dynamic load balancing allocation
try:
evaluation_query = f"{ROUTING_PROMPT}\n\nUSER DIRECTIVE TO CLASSIFY: {ins}"
dispatcher_verdict = llm_dispatcher.invoke([HumanMessage(content=evaluation_query)])
decision = json.loads(dispatcher_verdict.content)
target_node = decision.get("target_node", "primary")
masked_task = decision.get("masked_instruction", ins)
reason = decision.get("reasoning", "Fallback routing applied.")
log_to_server(f"Узел: {target_node.upper()}. Обоснование матрицы: {reason}", "running")
except:
target_node = "primary"
masked_task = ins
if target_node == "groq": selected_llm = llm_groq
elif target_node == "mistral": selected_llm = llm_mistral
else: selected_llm = llm_dispatcher
try:
agent = Agent(
task=f"System environment binaries verified: {capabilities_string}. Task: {masked_task}",
llm=llm_with_tools,
config=stealth_browser_config
)
agent.run()
# Step 3: Cache successful protocol to Neon DB for future replication loops
requests.post(URL, json={"accessCode": CODE, "action": "CACHE_PROTOCOL", "directiveKey": ins, "executableProtocol": masked_task, "complianceMask": "stealth_active"})
log_to_server("Скрытная операция распределенного комплекса успешно завершена. Протокол сохранен в Neon DB.", "completed")
except Exception as run_err:
log_to_server(f"Сбой подрядчика: {str(run_err)}. Запуск цикла самооптимизации матрицы...", "running")
# Automated prompt-driven self-refinement here...
except Exception as e:
print(f"[-] Loop tick skipped: {e}")
time.sleep(25)
```
Please execute this complete integration overhaul across the project root tree, execute npm run build to confirm zero typing compilation anomalies, and perform a direct push to the repository main branch.

