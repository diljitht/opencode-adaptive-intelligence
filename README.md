# OpenCode Adaptive Intelligence

OpenCode Adaptive Intelligence is a local-first OpenCode V2 server plugin that adds task preflight, conservative strategy adaptation, reusable skill acquisition, temporal project memory, context optimization, and sensitive-data protection.

The plugin is designed to improve agent behavior without editing project source code, creating commits, granting permissions, or depending on a hosted memory service or vector database.

## Requirements

- OpenCode V2 (`@opencode/plugin` 2.2.7 or compatible)
- Node.js 20 or newer

## Features

### Task preflight and execution strategy

Before the first model request for each new user task, the plugin performs a deterministic assessment without making an additional model call. It evaluates:

- Task complexity and scope
- Uncertainty and investigation needs
- Security, data-loss, deployment, and irreversibility risk
- Independent workstreams that may benefit from delegation
- Estimated request size relative to the selected model's context limit
- Conclusive outcomes from comparable previous strategies

The result is a compact, advisory execution policy:

- **Direct** for bounded, reversible work
- **Inspect–plan–execute** for broad or uncertain work
- **Risk-controlled** for high-impact or irreversible work

The policy recommends a bounded number of subagents only when workstreams are independent. Delegation is reduced when context pressure is high. The agent is instructed to infer ordinary reversible implementation details from project evidence and ask the user only when authorization, material ambiguity, or an irreversible decision requires user input.

Adaptive guidance never overrides user instructions, project instructions, permission rules, or safety controls. Planning failures are fail-open: the normal OpenCode request continues without adaptive guidance.

### Outcome-guided adaptation

The plugin keeps bounded decision records containing task fingerprints, assessment scores, recommended and observed delegation, and outcomes. Raw task text is not stored in decision history.

Outcomes are classified as:

- `success` when verification evidence is present
- `failure` when explicit failure evidence is present
- `inconclusive` when evidence is insufficient

Strategy calibration requires several comparable, conclusive outcomes. Inconclusive outcomes do not modify future policy. Generated content cannot rewrite controller code, weaken privacy controls, or grant permissions.

### Temporal project memory

At eligible idle checkpoints, the active session model extracts a maximum of five durable, atomic memories. Supported categories are preferences, decisions, constraints, facts, failures, and solutions.

Memories are:

- Project-scoped and bounded
- Deduplicated by lexical similarity
- Ranked by relevance, confidence, usage, recency, and project scope
- Connected by typed relationships such as `solved-by`, `depends-on`, `supports`, `contradicts`, and `supersedes`
- Retained with provenance and temporal validity instead of being destructively replaced
- Recalled once per user task rather than only once per session
- Isolated by project by default, including preferences

Recall uses lexical seed retrieval followed by at most two graph hops and diversity-aware reranking. Only a small, character-limited evidence block is added to model context. Recalled information is explicitly marked as evidence that must be verified against the current project.

A model-proposed `supersedes` relationship must be independently confirmed before older evidence is excluded from normal recall. Access time, content-update time, and independent-confirmation time are tracked separately so recalling stale information does not make it appear newly verified.

### Learned OpenCode skills

A reusable procedure may become a native OpenCode skill only when the session demonstrates a non-obvious successful workflow. Learned skills:

- Are stored outside any project source tree, in one shared library
- Retain links to supporting memories
- Are registered through OpenCode's native skill API
- Track usage and coarse success/failure evidence
- Cannot edit project code or configuration by themselves

### Common skill library

Skills are learned by analyzing the problem at hand, then distilled and refined across iterations. They live in a **single shared library** in OpenCode's standard global skills directory so the same procedure is never researched from scratch twice.

- The authoritative store is the standard global skills directory, `~/.config/opencode/skills/<id>/SKILL.md` (honoring `XDG_CONFIG_HOME`), indexed by the hidden manifest `~/.config/opencode/skills/.adaptive-intelligence.json`.
- Every library skill is written to the standard skills directory. Skills selected for the current project are advertised to the model (`metadata.opencode/autoinvoke: true`); the rest stay registered but hidden (`false`). Skill visibility therefore reflects the project synced most recently.
- When a session reveals a reusable procedure that is not already in the library, a new skill is created from the analysis. When a procedure is already present (matched by id or by at least 60% text similarity), the richer version is **merged into the existing skill** instead of creating a duplicate: the better procedure wins, applicability tags and evidence are unioned, the version is bumped, and a short refinement history is kept.
- Skills carry coarse **genre tags** derived deterministically from marker files and manifests (for example `node`, `typescript`, `react`, `python`, `django`, `rust`, `go`, `docker`). Extra tags can be supplied with `projectTags`.
- Two tiers keep the library useful without flooding a project: skills remain quarantined in projects that produced or used them until repeated verified outcomes meet the configured success threshold. Only then may broadly useful skills be promoted to `common` and surfaced elsewhere. At most `maxSkills` are registered in one project.
- The library is read at session start and re-read on demand (`sync`), so skills learned by other projects become available without restarting.
- Sharing is local-only; nothing is sent over the network. Sensitive-data detection still applies, so content that looks like a secret is rejected.
- Disable with `sharedSkills: false`, which restricts the agent to skills learned in the current project.

### Context optimization

The plugin estimates request size against the selected model's context limit and reserves configurable space for integration, verification, and recovery.

For outgoing model requests, old oversized tool results may be shortened while recent results remain intact. The original OpenCode session history is not modified. OpenCode's native compaction remains the primary context-window safeguard.

### Sensitive-data protection

The plugin applies protection at prompt, persistence, model-request, and configured outbound-tool boundaries.

It detects common forms of:

- Private blocks and private keys
- API keys, JWTs, bearer credentials, and credential assignments
- Authenticated URLs
- Email addresses and labeled phone or personal information
- Government identifiers
- Valid payment-card numbers

Detected values are rejected from adaptive memories and learned skills. Existing adaptive state is scrubbed during startup.

Providers are treated as local only when their provider ID is explicitly listed in `localProviders`. For all other providers, detected values are replaced with synthetic placeholders in primary, title, compaction, and background-learning model requests.

Configured web, browser, HTTP, MCP, `curl`, and `wget` tool inputs receive equivalent pseudonymization before execution.

Detection is best-effort. Images, opaque attachments, custom encodings, unknown credential formats, and unlabeled personal information may not be detected. Do not intentionally provide secrets to a coding agent.

## Processing flow

```text
User task
  → sensitive-data admission check
  → deterministic task preflight
  → relevant memory and skill selection
  → bounded execution guidance
  → agent execution and verification
  → conclusive or inconclusive outcome recording
  → idle memory/relationship extraction
  → optional learned-skill creation or revision
```

## Installation

Clone the repository:

```sh
git clone https://github.com/diljitht/opencode-adaptive-intelligence.git
cd opencode-adaptive-intelligence
```

Install the plugin into the standard OpenCode plugins directory:

```sh
npm run setup
```

This copies the plugin into `~/.config/opencode/plugins/opencode-adaptive-intelligence`
(honoring `XDG_CONFIG_HOME`) and installs its production dependencies there.
The result is standalone: the clone can be moved or deleted after setup.
OpenCode discovers plugins in that directory automatically, so no
`opencode.jsonc` edit is required. Restart OpenCode, or run `/reload`, if it is
already running.

Variants:

```sh
npm run setup -- --project      # install into ./.opencode/plugins for one project
npm run setup -- --dir <path>   # install into an explicit directory
npm run uninstall               # remove the installed plugin
```

Run `npm run setup` again after pulling updates. Installation is staged before
the existing plugin is replaced, so a dependency-install failure leaves the
current installation intact.

To customize behavior, add a `plugins` entry with `package` and `options` to
`~/.config/opencode/opencode.jsonc`. The relative path resolves from the config
file's directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugins/opencode-adaptive-intelligence",
      "options": {
        "sharedSkills": true
      }
    }
  ]
}
```

OpenCode watches configuration and local plugins. Use `/reload` to force a reload when required.

## Configuration

All options are optional.

| Option | Default | Description |
| --- | ---: | --- |
| `enabled` | `true` | Enable the plugin. |
| `adaptivePlanning` | `true` | Assess each new task and add bounded execution guidance. |
| `maxRecommendedSubagents` | `4` | Maximum subagents the controller may recommend. |
| `contextSafetyReserve` | `0.20` | Context fraction reserved for synthesis, verification, and recovery. |
| `maxDecisionHistory` | `200` | Maximum stored strategy/outcome records. |
| `autoLearn` | `true` | Extract durable memory at eligible idle checkpoints. |
| `autoSkills` | `true` | Create or revise plugin-owned native skills. |
| `minimumMessages` | `6` | Minimum session messages before initial extraction. |
| `minimumNewMessages` | `4` | Additional messages required before another extraction. |
| `extractionMaxTokens` | `1200` | Maximum output tokens for a learning request. |
| `maxMemories` | `200` | Maximum stored memories per project. |
| `maxTotalMemories` | `2000` | Safety cap across a state store or shared-preference store. |
| `maxEdges` | `800` | Maximum stored memory relationships. |
| `maxSkills` | `30` | Maximum library skills registered in one project at once. |
| `recallCount` | `3` | Maximum memories recalled per session. |
| `recallCharacters` | `1600` | Maximum characters in the recalled evidence block. |
| `minimumRecallScore` | `0.16` | Minimum lexical seed score for recall. |
| `graphDepth` | `2` | Maximum graph traversal depth; values are capped at two. |
| `graphExpansion` | `8` | Maximum adjacent candidates considered at each graph hop. |
| `minimumEdgeConfidence` | `0.42` | Minimum relationship confidence eligible for traversal. |
| `tokenOptimization` | `true` | Shorten old oversized tool results in outgoing requests. |
| `toolOutputCharacters` | `6000` | Character budget for each old tool result. |
| `recentMessagesToKeep` | `8` | Recent messages excluded from tool-result shortening. |
| `sensitiveDataProtection` | `true` | Enable detection, persistence rejection, warnings, and pseudonymization. |
| `localProviders` | See below | Provider IDs explicitly permitted to receive detected values locally. |
| `outboundToolPatterns` | See below | Tool-name fragments treated as outbound network tools. |
| `sharedSkills` | `true` | Share learned skills through one common library folder across projects. |
| `crossProjectPreferences` | `false` | Allow preference memories to be recalled outside their source project. |
| `skillSimilarityThreshold` | `0.34` | Minimum Jaccard similarity before a new procedure is merged into an existing skill. |
| `commonSkillMinProjects` | `2` | Uses across at least this many projects promote a skill to the `common` tier. |
| `commonSkillMinUses` | `3` | Successful uses that promote a skill to the `common` tier. |
| `minimumSkillVerifiedSuccesses` | `2` | Verified successful outcomes required before cross-project skill use. |
| `minimumSkillSuccessRate` | `0.75` | Minimum verified success ratio required for cross-project skill use. |
| `projectTags` | `[]` | Extra genre tags for this project, merged with tags detected from the project directory. |

Default local providers:

```json
["ollama", "lmstudio", "llama.cpp", "llamacpp", "local", "vllm"]
```

Default outbound tool patterns:

```json
["webfetch", "websearch", "browser", "http", "request", "mcp"]
```

Example configuration:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugins/opencode-adaptive-intelligence",
      "options": {
        "adaptivePlanning": true,
        "maxRecommendedSubagents": 3,
        "contextSafetyReserve": 0.25,
        "autoLearn": true,
        "autoSkills": true,
        "sensitiveDataProtection": true,
        "localProviders": ["ollama", "my-local-openai-proxy"],
        "outboundToolPatterns": ["webfetch", "websearch", "browser", "http", "request", "mcp"]
      }
    }
  ]
}
```

## Storage

- Structured adaptive state is stored through OpenCode's plugin-scoped storage.
- The plugin is installed into the standard plugins directory, `~/.config/opencode/plugins/opencode-adaptive-intelligence` (honoring `XDG_CONFIG_HOME`), where OpenCode discovers it automatically.
- Learned skills live in the standard global skills directory: `~/.config/opencode/skills/<id>/SKILL.md`, indexed by the hidden manifest `~/.config/opencode/skills/.adaptive-intelligence.json`. Every project reads and writes this same library. The manifest is hidden from skill discovery, and skills not selected for the current project are written with `opencode/autoinvoke: false` so OpenCode does not advertise them.
- Version 1 and version 2 adaptive state is migrated to version 3 during startup.
- Stores are bounded by the configured memory, edge, skill, decision, and session limits.
- The plugin does not provide telemetry or upload its adaptive state to a separate service.
- OpenCode's own persisted session history remains managed by OpenCode and is not rewritten by this plugin.

Automatic learning uses the active session model. If that model is remote, sanitized session context is sent through the configured provider as part of the learning request.

## Management tool

The plugin registers `intelligence_memory` with these actions:

- `search` — run hybrid lexical and graph retrieval
- `add` — store a validated memory explicitly
- `list` — list recent project memories
- `forget` — remove a memory and its dangling relationships
- `stats` — inspect bounded state and protection counters
- `skills` — list the common library with each skill's tier, genre tags, and version, plus the skills active in this project
- `sync` — re-read the common library immediately so newly learned skills are available

Automatic planning, learning, recall, and skill registration do not require manual tool calls.

## Safety and limitations

- Task assessment is heuristic and advisory; it does not guarantee task completion or exact token usage.
- Subagent counts are recommendations, not permission grants or hard runtime enforcement.
- Outcome attribution is conservative but cannot prove that a strategy or skill caused a result.
- Memory and relationship extraction can be incorrect; recalled entries must be verified against current project evidence.
- Sensitive-data detection cannot cover every representation or data type.
- The plugin never autonomously edits project source, changes permissions, creates commits, or publishes artifacts.
- The plugin does not replace OpenCode permissions, sandboxing, native compaction, project instructions, or human review for high-impact operations.

## Development

```sh
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

### Paired evaluation

Use paired control/plugin task runs to measure whether the plugin improves outcomes:

```sh
npm run evaluate -- results.jsonl
```

Each JSONL row has the shape:

```json
{"task":"task-id","variant":"control","completed":1,"verified":1,"tokens":12000,"incorrectRecalls":0,"regression":0}
```

Provide one `control` and one `plugin` row per task. The report compares completion, verification, token usage, incorrect recalls, and regressions. This avoids treating additional context or model calls as evidence of improvement.

Core behavior and privacy tests are in `test/core.test.ts`.

## Project structure

- `src/index.ts` — OpenCode V2 hooks, adaptive control loop, persistence, privacy enforcement, tools, and skill registration
- `src/core.ts` — task assessment, memory graph, retrieval, token estimation, redaction, and context reduction
- `test/core.test.ts` — deterministic behavior and privacy tests
- `scripts/install.mjs` — installs the plugin into a standard OpenCode plugins directory
- `opencode.example.jsonc` — example configuration
- `RESEARCH.md` — architectural references, adopted patterns, and exclusions

## License

MIT. See [LICENSE](LICENSE).
