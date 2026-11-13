# Design research

Research checked on 2026-11-11. OpenCode V2 documentation is the API source of truth.

## Systems reviewed

- [OpenCode V2 plugin API](https://opencode.ai/docs/build/plugins/) — `Plugin.define`, session hooks, plugin storage, tools, and the native skill discovery/registry API.
- [OpenCode V2 compaction](https://opencode.ai/docs/compaction/) — native automatic compaction and recent-context retention; this plugin complements rather than replaces it.
- [OpenCode Mem](https://github.com/tickernelz/opencode-mem) — local vector recall, idle capture, profiles, deduplication, and V2 skill registration.
- [OpenCode Deep Memory](https://github.com/BD7PIL/opencode-deep-memory) — BM25-style local retrieval, cache-stable injection, tool-output caps, consolidation, and recoverable compression.
- [Awesome OpenCode](https://github.com/awesome-opencode/awesome-opencode) — Agent Memory, Dynamic Context Pruning, Chisle, Magic Context, Mem0, Handoff, and related plugins.

OpenCode projects were not treated as the only design pool. The following mature, openly inspectable cross-agent systems were reviewed for the subsystem where they are strongest:

| Subsystem | Reference | License | Technique considered |
| --- | --- | --- | --- |
| Temporal graph memory | [Graphiti](https://github.com/getzep/graphiti) | Apache-2.0 | Validity windows, provenance, incremental updates, hybrid keyword/semantic/graph retrieval, and graph-distance reranking. |
| Atomic memory | [Mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | Atomic extraction, deduplication, update/delete decisions, and retrieval instead of transcript replay. |
| Coding-session memory | [Claude-Mem](https://github.com/thedotmack/claude-mem) | Apache-2.0 | Background observation and progressive disclosure: compact search index, timeline, then selected full observations. |
| Skill methodology | [Superpowers](https://github.com/obra/superpowers) | MIT | Composable trigger-based skills, evidence-first workflows, verification, and behavioral evaluation of skill changes. |
| Autonomous coding loop | [OpenHands](https://github.com/OpenHands/OpenHands) | MIT | Explicit action/observation loops, sandbox boundaries, trajectory evaluation, and measurable task completion. |
| Coding-agent interface | [SWE-agent](https://github.com/SWE-agent/SWE-agent) | MIT | Constrained tools, repository inspection before editing, compact trajectories, and benchmark-grounded evaluation. |
| Measured self-improvement | [DSPy](https://github.com/stanfordnlp/dspy) and GEPA | MIT | Optimize prompts or procedures against explicit outcome metrics rather than accepting unconstrained self-rewrites. |
| Context reduction | [Context Mode](https://github.com/mksglu/context-mode) | Elastic-2.0, source-available | Keep full local output recoverable, return bounded excerpts, FTS/BM25 retrieval, byte budgets, and reproducible token-savings measurements. No code was copied. |
| Semantic code navigation | [Serena](https://github.com/oraios/serena) | Openly inspectable MCP project | Symbol-level retrieval instead of repeatedly loading whole files. Not adopted because OpenCode already supplies code tools and this plugin should not become an IDE. |
| Secret detection | [detect-secrets](https://github.com/Yelp/detect-secrets) | Apache-2.0 | Layered detectors and false-positive controls at commit/persistence boundaries. |
| PII protection | [Presidio](https://github.com/microsoft/presidio) | MIT | Detection, anonymization, synthetic replacement, and customizable recognizers. |

Projects without a clear open-source license were not used as implementation sources. Popularity was only a discovery signal; maintenance, license, tests/evaluations, local operation, and architectural fit were the selection criteria.

## Adopted choices

1. **Local first and no external service.** OpenCode plugin storage holds bounded JSON state; the plugin installs into the standard plugins directory (`~/.config/opencode/plugins/`) and generated skill files are inspectable under the standard global skills directory (`~/.config/opencode/skills/`).
2. **One bounded extraction call, only after meaningful growth.** This avoids an LLM call after every turn and reuses the current session/model.
3. **Dependency-free hybrid retrieval at this scale.** Lexical relevance produces precise seeds; a bounded local adjacency graph expands one or two hops; confidence, outcomes, recency, and maximal-marginal-relevance-style diversity rerank the final set. At roughly 200 memories, a graph database and embedding service add more operational cost than value.
4. **Temporal facts rather than destructive replacement.** A high-confidence `supersedes` edge must be observed at least twice before it closes the old memory's validity window. History and provenance remain stored; inactive memories are excluded from normal recall.
5. **Typed, evidence-scoped relationships.** `supports`, `contradicts`, `caused-by`, `solved-by`, `supersedes`, `depends-on`, `applies-to`, and `related-to` edges are bounded and confidence-gated. Deterministic high-precision links supplement model-extracted links.
6. **Pull only a few diverse memories.** The plugin never injects full session archives. Graph traversal has a strict depth, fan-out, result-count, and character budget.
7. **Evidence-linked skill mutation.** Skills live in one shared library in the standard global skills directory (`~/.config/opencode/skills/`) that every project shares. Durable files remain hidden, while project-relevant entries are advertised through OpenCode's location-scoped native skill transform. Skills retain supporting memory IDs and feed task-scoped success/failure outcomes back into evidence and edge confidence signals. New procedures are distilled into existing skills instead of duplicated, and broadly useful skills are promoted to a common tier. The plugin never edits project source files.
8. **Loss-minimizing token control.** Only old, oversized tool results are shortened in outgoing model requests. Persisted OpenCode history remains unchanged and remains the recovery source.
9. **Secret redaction and bounded stores.** Captures are sanitized, deduplicated, length-limited, and evicted by utility; dangling graph edges are pruned.
10. **Privacy at request and persistence boundaries.** Prompt admission marks sensitive sessions, remote model requests receive synthetic placeholders, local-provider IDs are explicit, and memory/skill writes fail closed.
11. **Deterministic preflight before action.** Analyze complexity, uncertainty, risk, parallelizability, and current context pressure without another model call. Small work stays direct; larger work receives inspect/plan/execute guidance; risky work preserves rollback and asks only for genuine authorization or irreversible choices.
12. **Bounded delegation, not “more agents is better.”** Recommend subagents only for independent workstreams. Cap the count, reduce it under context pressure, require non-overlapping ownership, and reserve parent context for synthesis and verification.
13. **Conservative decision learning.** Keep bounded strategy/outcome records. Calibrate only after multiple comparable conclusive outcomes; recognize structured exit codes and common test-runner summaries, and treat weak evidence as inconclusive so noisy self-evaluation cannot rapidly degrade policy. Evidence confirmations are deduplicated by source session. Never let generated content rewrite controller code or weaken permissions/privacy.

## Deliberate exclusions

- No autonomous project-code edits or commits.
- No hosted memory dependency or telemetry.
- No heavyweight local embedding model.
- No replacement for OpenCode V2's native compaction.
- No claim that self-generated memories are always correct; injected entries are explicitly labeled as evidence to verify.
