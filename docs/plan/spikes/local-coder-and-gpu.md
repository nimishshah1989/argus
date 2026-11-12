# Local coder and free-GPU spike — 12 November 2026

Purpose: decide where the coding model runs while the product is built. No product code was changed.

## TwIL-8B baseline (kept at the user's request)

| Item        | Result                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Model       | `webAI-Official/TwIL-8B`, Granite 4.2 8B fine-tune, Q4_K_M, 5.3 GB                              |
| License     | **webAI Non-Commercial License 1.0** — development/research only; not a production coder        |
| Runtime     | derived `twil-coder:24k`, 24,576 context, 4,096 output cap, about 9.5 GB resident on a 16 GB M4 |
| Tool call   | 27.7 s for a 76-token tool call; produced a valid `read_file` call                              |
| Coding task | 221.2 s; consumed the full 1,200-token cap as reasoning and returned **no code**                |
| Verdict     | Useful as a baseline, not viable as the sole coder for this repo                                |

The coding fixture is `tmp/twil-bench` (ignored scratch space): a small `slugify` bug with two failing tests. The model was asked to edit only `slug.ts`; it never reached the answer within the cap. At the configured 4,096-token ceiling the same behaviour would take many minutes per attempt.

## Why the local 16 GB machine is the constraint

A 24 GB GPU can run a materially better open coder: Qwen3-Coder-30B-A3B-Instruct (Apache-2.0), 30.5B total / 3.3B active, agentic/tool-trained, 262k context. A 4-bit build is roughly 18 GB, so it does not fit safely beside the OS on 16 GB. Qwen2.5-Coder-7B is Apache-2.0 but, on this Ollama build, it emitted plain JSON instead of OpenAI `tool_calls`; it is not the DSH coder.

## Free / near-free GPU options (checked 12 Nov 2026)

| Option                      | What is actually free                                                                      | Fit for Qwen3-Coder-30B                                                                                                                            | Caveat                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Lightning AI Free**       | Up to 50 GPU hours / 30 credits; L4 24 GB at $0.79/hr; no credit card                      | **Best first test**: 24 GB, 50 h                                                                                                                   | Free Studio restarts every 4 h; no SLA                      |
| **Modal Free**              | $30/month credits, per-second billing, scale-to-zero                                       | Good for bursts; L4/A10G 24 GB                                                                                                                     | Serverless packaging; cold starts; not a persistent dev box |
| **Google Cloud Free Trial** | $300 / 90 days                                                                             | **No GPU during trial** — the official docs say non-billable trial accounts cannot add GPUs; upgrading ends the trial and enables paid GPU billing | Do not count this as a free GPU                             |
| **Oracle Cloud Free Tier**  | $300 / 30 days plus Always Free ARM                                                        | GPU trial is capacity/region dependent; Always Free is CPU-only                                                                                    | 30-day trial; ARM 8B inference is slow                      |
| **Azure Free**              | $200 / 30 days                                                                             | GPU quota and paid upgrade may be required                                                                                                         | Short window; verify before relying                         |
| **Hugging Face**            | Free CPU Spaces / limited ZeroGPU; PRO $9/mo gives 8× ZeroGPU quota + $2 inference credits | 7B–14B experiments                                                                                                                                 | Spaces sleep/queue; Inference Endpoints are paid            |
| **Vast.ai**                 | No free tier; RTX 4090 from ~$0.36/hr                                                      | 24 GB, good                                                                                                                                        | Community hosts; preemption                                 |
| **RunPod**                  | No free tier; 4090 ~$0.34/hr community, ~$0.89/hr secure                                   | 24 GB, good                                                                                                                                        | Secure Cloud is the reliable option                         |
| **Kaggle / Colab**          | Free T4 16 GB sessions                                                                     | 7B–14B only                                                                                                                                        | Session limits; not 30B                                     |

## Recommendation

1. **Do not spend the Google $300 trial on GPUs.** The trial deliberately blocks GPU attachments until you upgrade; after upgrading you are on paid billing and can incur charges.
2. **Use Lightning AI Free first.** It is the only no-card offer with a 24 GB L4 and enough hours (50) to evaluate Qwen3-Coder-30B-A3B on the same fixture and on one real microtask.
3. If the 50 hours are useful, continue on **Modal's $30/month credits** (recurring, scale-to-zero) or **Vast.ai at ~$0.36/hr** for a 2-hour batch. At two hours/day, Vast is roughly $22/month.
4. Run the model server remotely, keep DSH and the repo on the Mac, and reach the server through an SSH tunnel. Never expose an unauthenticated inference port.
5. Use vLLM for the tool protocol (Qwen3-Coder tool parser). Do not use the Ollama Qwen2.5-Coder route: it failed to emit `tool_calls`.
6. Only then decide whether the local TwIL baseline is worth keeping for cheap, non-critical experiments.

## Setup sketch for the Lightning test

1. Create a free Lightning Studio with an L4 (24 GB).
2. Install vLLM and serve `Qwen/Qwen3-Coder-30B-A3B-Instruct` (4-bit/AWQ) with a 16k–32k context and automatic tool choice.
3. From the Mac, tunnel the port: `ssh -L 8000:127.0.0.1:8000 ...`.
4. Point the DSH `ollama`/OpenAI-compatible provider at `http://127.0.0.1:8000/v1` and keep the model id in `docs/orchestration.yaml`.
5. Run `tmp/twil-bench` first, then one bounded repo microtask. Measure pass/fail, wall time, tool calls and output quality.
6. Stop the Studio when the batch is done. A free GPU hour is only free if it is not left idle.

## Sources

- [Google Cloud Free Program — GPU restriction during trial](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [Lightning AI pricing — free GPU hours and L4 rate](https://lightning.ai/pricing)
- [Modal free credits](https://modal.com/llms.txt)
- [Hugging Face pricing — PRO / ZeroGPU](https://huggingface.co/pricing)
- [Vast.ai RTX 4090 rate](https://gpueconomy.com/providers/vast-ai/rtx-4090)
- [RunPod RTX 4090 rate](https://gpueconomy.com/providers/runpod/rtx-4090)
- [Qwen3-Coder-30B-A3B-Instruct model card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct)

## Hosted free-model gate through the real DSH harness — 2026-11-12

Route: `openrouter` provider in `~/.dsh/profiles/desktop/cordis.patch.yml`, models
`nvidia/nemotron-3-ultra-550b-a55b:free` (coder candidate) and `cohere/north-mini-code:free` (probe).
Both answer directly in about 1 s at $0.

**Two harness facts learned the hard way:**

1. `list_subagent_models({provider:"openrouter"})` is **not** a route check. It reads the session
   allowlist from the profile file; a process that booted before the profile patch returns the models
   and then fails every dispatch with `PI_AI_ERROR: Provider is not configured: openrouter`. Replace
   STEP 0 with a **1-word dispatch probe** (cohere, ~2 s); only a real child proves the route.
2. A `headers.Authorization` on the provider profile does **not** authenticate a pi-ai catalog provider.
   `openrouter` resolves credentials through its own auth (`OPENROUTER_API_KEY` env or a stored record);
   headers are applied only after auth succeeds. The fix is a record in the watched credential file
   `~/.dsh/.credentials.yaml`:
   `records: { llm-pi-ai/openrouter: { kind: api-key, key: <key> } }`. The store hot-reloads, so the
   running harness picks it up without a restart. Do not put provider keys in `headers`.

**Gate results (fresh harness, real DSH tool loop):**

| Test             | Result         | Model wall       | Tool calls  | Benchmark to beat | Notes                                                          |
| ---------------- | -------------- | ---------------- | ----------- | ----------------- | -------------------------------------------------------------- |
| 0 Probe          | PASS           | 1.7 s            | 0           | ~2 s              | cohere 1-word dispatch                                         |
| A Tool probe     | PASS           | 40 s             | 4           | 28.5 s / 7 turns  | read HANDOFF, 5 accurate bullets, branch correct, no edits     |
| B slug fixture   | PASS           | 22 s             | 6           | 18.7 s / 5 turns  | red→green, 5 added/1 removed lines, test byte-identical        |
| C CSV fixture    | PASS           | 40 s             | 10          | 31.4 s / 10 turns | generic RFC4180 parser, no hardcoding, test byte-identical     |
| 5 Real microtask | PASS after fix | 141/203/87/183 s | 29/27/11/21 | —                 | shared-login E2E; 2 planner revisions + fresh review FAIL→PASS |

**Verdict: fit to be the build coder** for this repo's microtask shape, with conditions: free tier only
(stop on 429, never silently use a paid route), one coder at a time, a fresh reviewer for every diff,
and every packet must state cross-test isolation (the E2E microtask needed per-project machines before
the reviewer passed it). The tree keeps the gate's uncommitted evidence: `apps/web/e2e/fixtures.ts`
(+VC-7/VC-8, optional `actingPersonId`), `apps/web/e2e/shared-login.spec.ts` (new).
