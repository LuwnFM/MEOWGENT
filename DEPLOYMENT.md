# Agent platform deployment

## Components

- Vercel hosts the existing Next.js UI and `/api/agent` route.
- Postgres stores routing configuration and durable agent tasks.
- A VPS runs the long-lived Python worker in Docker.
- A Redis service provides the worker queue; Inngest receives durable workflow events.
- Skills are registered under `skills/<skill-id>/skill.json`.

## Vercel

Set these server-side environment variables in the Vercel project:

```text
APP_ACCESS_CODE=...
DATABASE_URL=...
OPENROUTER_API_KEY=...
S3_BUCKET=...
S3_ENDPOINT=...
S3_REGION=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
REDIS_URL=...
INNGEST_EVENT_KEY=...
```

The existing `POSTGRES_URL` fallback remains supported. Do not expose provider keys through `NEXT_PUBLIC_*` variables.

## Worker VPS

Install Docker and copy the repository to the VPS. Create `.env.worker` from `.env.worker.example`, fill in the secrets, then run:

```bash
docker compose -f docker-compose.worker.yml up -d --build
docker compose -f docker-compose.worker.yml logs -f agent-worker
```

For a VirtualBox Linux VM, use bridged or host-only networking as appropriate, expose only the Vercel/Redis/S3 connections required by the worker, and keep the VM firewall enabled. This lab configuration runs the worker as `root` with a writable filesystem so it can install packages and use system tools. Do not reuse this configuration directly on a host or shared production server.

The worker keeps the existing provider cascade and Browser Use path. Before each task it refreshes the skill registry and can select a registered skill or one of the read-only Linux tools. If neither is selected, it uses the original Browser Use execution path.

At startup the worker queries each provider's `/models` endpoint. OpenRouter prefers `z-ai/glm-5.2:free`, then falls back to current free candidates such as Nemotron, GPT-OSS or Gemma. Groq similarly checks its advertised models and selects the first configured candidate. Set `AGENT_MODEL` or `GROQ_MODEL` to override the preference order.

## Adding a skill

Create a directory with a manifest and a Python entrypoint:

```text
skills/my-skill/
  skill.json
  main.py
```

`skill.json`:

```json
{
  "id": "my-skill",
  "name": "My skill",
  "description": "Short description used by the dispatcher.",
  "entrypoint": "main.py",
  "timeout_seconds": 60
}
```

The entrypoint receives a JSON object on stdin. It must write its result to stdout. Skills are only eligible when their manifest is valid, their entrypoint is inside their own directory, and the dispatcher returns that exact registered ID.

The native model tool `save_verified_skill` can create a new skill. The worker compiles the generated code, runs its declared test instruction in a temporary skill directory, and only then writes `main.py` and `skill.json` into `skills/`. Docker Compose mounts that directory so successful skills survive container recreation.

`install_python_package` accepts a package spec, downloads binary wheels only, checks each artifact SHA-256 against VirusTotal, and blocks malicious or unknown verdicts by default. VirusTotal is a reputation signal, not a guarantee; do not upload private source code, and use `ALLOW_UNKNOWN_PACKAGE_SCAN=true` only after manual review.

The general native tool `install_package` supports `apt`, `pip` and `npm`. It can install ordinary Linux utilities, Python libraries and Node CLI programs from the configured registries, not only Kali packages. It still rejects arbitrary URLs and local paths. `npm` installs use `--ignore-scripts`; packages requiring install scripts should be reviewed and installed manually in the VM.

`discover_kali_tools` reads the VM's current APT catalog and installed executables. This keeps the skill list synchronized with the Kali image instead of copying a stale list from the public tools page. Install only the Kali metapackages needed for the authorized work; installing every package is large, slow, and increases attack surface.

The native `install_kali_package` tool is intentionally dynamic rather than limited to a fixed approved catalog. It accepts a package name only when it matches APT naming rules and is present in the configured Kali repositories; arbitrary URLs, shell fragments and local file paths are rejected. Review the requested package and target before allowing installation, especially for offensive or dual-use tooling.

## Security boundary

The included Linux tools are intentionally read-only and allowlisted. Do not add a generic shell command tool or mount the host Docker socket. Treat generated code as untrusted and move stronger isolation to a separate VM, gVisor, or Firecracker when arbitrary third-party code must be executed.

The native `run_linux_command` tool is available only when `AGENT_ALLOW_SHELL=true`. It executes as `root` inside the worker VM, so the VM is the security boundary. Keep the VM separate from the developer host, never mount `/var/run/docker.sock`, and do not set Docker Compose `privileged: true`.

## Checks

```bash
python -m unittest discover -s tests -v
npm run build
```