import { createHash } from "node:crypto"

export type MemoryKind = "preference" | "decision" | "constraint" | "fact" | "failure" | "solution"
export type MemoryRelation =
  | "supports"
  | "contradicts"
  | "caused-by"
  | "solved-by"
  | "supersedes"
  | "depends-on"
  | "applies-to"
  | "related-to"
export type TaskStrategy = "direct" | "inspect-plan-execute" | "risk-controlled"
export type DecisionOutcome = "pending" | "success" | "failure" | "inconclusive"
export type SensitiveCategory =
  | "private-content"
  | "private-key"
  | "api-token"
  | "cloud-credential"
  | "authorization"
  | "password"
  | "email"
  | "phone"
  | "government-id"
  | "payment-card"
  | "personal-data"

export interface SensitiveScan {
  text: string
  categories: SensitiveCategory[]
  replacements: number
}

export interface Memory {
  id: string
  kind: MemoryKind
  text: string
  keywords: string[]
  projectID: string
  confidence: number
  uses: number
  createdAt: string
  updatedAt: string
  sourceSession?: string
  validFrom?: string
  validUntil?: string
  supersededBy?: string
}

export interface MemoryEdge {
  id: string
  from: string
  to: string
  relation: MemoryRelation
  confidence: number
  confirmations: number
  contradictions: number
  active: boolean
  projectID: string
  sourceSession?: string
  createdAt: string
  updatedAt: string
}

export interface LearnedSkill {
  id: string
  name: string
  description: string
  content: string
  triggerTerms: string[]
  projectID: string
  version: number
  uses: number
  successes: number
  failures: number
  createdAt: string
  updatedAt: string
  evidenceMemoryIDs?: string[]
}

export interface SessionCheckpoint {
  fingerprint: string
  messageCount: number
  extractionCount: number
  updatedAt: string
}

export interface TaskAssessment {
  complexity: number
  uncertainty: number
  risk: number
  parallelism: number
  contextPressure: number
  strategy: TaskStrategy
  recommendedSubagents: number
  reasons: string[]
}

export interface DecisionRecord {
  id: string
  sessionID: string
  taskFingerprint: string
  assessment: TaskAssessment
  actualSubagents: number
  outcome: DecisionOutcome
  createdAt: string
  updatedAt: string
}

export interface AdaptiveState {
  version: 3
  memories: Memory[]
  edges: MemoryEdge[]
  skills: LearnedSkill[]
  decisions: DecisionRecord[]
  sessions: Record<string, SessionCheckpoint>
  stats: {
    extractions: number
    extractionErrors: number
    injectedMemories: number
    compactedCharacters: number
    sensitiveWarnings: number
    redactedRequests: number
    redactedToolCalls: number
    blockedMemoryWrites: number
    graphEdgesCreated: number
    graphTraversals: number
    graphExpandedMemories: number
    taskAssessments: number
    decisionSuccesses: number
    decisionFailures: number
    decisionInconclusive: number
  }
}

export interface PluginOptions {
  enabled: boolean
  autoLearn: boolean
  autoSkills: boolean
  tokenOptimization: boolean
  minimumMessages: number
  minimumNewMessages: number
  maxMemories: number
  maxSkills: number
  recallCount: number
  recallCharacters: number
  toolOutputCharacters: number
  recentMessagesToKeep: number
  extractionMaxTokens: number
  minimumRecallScore: number
  sensitiveDataProtection: boolean
  localProviders: string[]
  outboundToolPatterns: string[]
  maxEdges: number
  graphDepth: number
  graphExpansion: number
  minimumEdgeConfidence: number
  adaptivePlanning: boolean
  maxRecommendedSubagents: number
  contextSafetyReserve: number
  maxDecisionHistory: number
}

export const DEFAULT_OPTIONS: PluginOptions = {
  enabled: true,
  autoLearn: true,
  autoSkills: true,
  tokenOptimization: true,
  minimumMessages: 6,
  minimumNewMessages: 4,
  maxMemories: 200,
  maxSkills: 30,
  recallCount: 3,
  recallCharacters: 1_600,
  toolOutputCharacters: 6_000,
  recentMessagesToKeep: 8,
  extractionMaxTokens: 1_200,
  minimumRecallScore: 0.16,
  sensitiveDataProtection: true,
  localProviders: ["ollama", "lmstudio", "llama.cpp", "llamacpp", "local", "vllm"],
  outboundToolPatterns: ["webfetch", "websearch", "browser", "http", "request", "mcp"],
  maxEdges: 800,
  graphDepth: 2,
  graphExpansion: 8,
  minimumEdgeConfidence: 0.42,
  adaptivePlanning: true,
  maxRecommendedSubagents: 4,
  contextSafetyReserve: 0.2,
  maxDecisionHistory: 200,
}

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "i", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "was", "we", "were", "will", "with", "you", "your",
])

export function emptyState(): AdaptiveState {
  return {
    version: 3,
    memories: [],
    edges: [],
    skills: [],
    decisions: [],
    sessions: {},
    stats: {
      extractions: 0,
      extractionErrors: 0,
      injectedMemories: 0,
      compactedCharacters: 0,
      sensitiveWarnings: 0,
      redactedRequests: 0,
      redactedToolCalls: 0,
      blockedMemoryWrites: 0,
      graphEdgesCreated: 0,
      graphTraversals: 0,
      graphExpandedMemories: 0,
      taskAssessments: 0,
      decisionSuccesses: 0,
      decisionFailures: 0,
      decisionInconclusive: 0,
    },
  }
}

export function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

export function readOptions(raw: unknown): PluginOptions {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  return {
    enabled: value.enabled !== false,
    autoLearn: value.autoLearn !== false,
    autoSkills: value.autoSkills !== false,
    tokenOptimization: value.tokenOptimization !== false,
    minimumMessages: clamp(value.minimumMessages, DEFAULT_OPTIONS.minimumMessages, 2, 100),
    minimumNewMessages: clamp(value.minimumNewMessages, DEFAULT_OPTIONS.minimumNewMessages, 1, 50),
    maxMemories: clamp(value.maxMemories, DEFAULT_OPTIONS.maxMemories, 10, 2_000),
    maxSkills: clamp(value.maxSkills, DEFAULT_OPTIONS.maxSkills, 1, 200),
    recallCount: clamp(value.recallCount, DEFAULT_OPTIONS.recallCount, 0, 10),
    recallCharacters: clamp(value.recallCharacters, DEFAULT_OPTIONS.recallCharacters, 200, 8_000),
    toolOutputCharacters: clamp(value.toolOutputCharacters, DEFAULT_OPTIONS.toolOutputCharacters, 1_000, 50_000),
    recentMessagesToKeep: clamp(value.recentMessagesToKeep, DEFAULT_OPTIONS.recentMessagesToKeep, 2, 30),
    extractionMaxTokens: clamp(value.extractionMaxTokens, DEFAULT_OPTIONS.extractionMaxTokens, 300, 4_000),
    minimumRecallScore: clamp(value.minimumRecallScore, DEFAULT_OPTIONS.minimumRecallScore, 0, 2),
    sensitiveDataProtection: value.sensitiveDataProtection !== false,
    localProviders: Array.isArray(value.localProviders)
      ? value.localProviders.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase()).slice(0, 30)
      : DEFAULT_OPTIONS.localProviders,
    outboundToolPatterns: Array.isArray(value.outboundToolPatterns)
      ? value.outboundToolPatterns.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase()).slice(0, 50)
      : DEFAULT_OPTIONS.outboundToolPatterns,
    maxEdges: clamp(value.maxEdges, DEFAULT_OPTIONS.maxEdges, 20, 10_000),
    graphDepth: clamp(value.graphDepth, DEFAULT_OPTIONS.graphDepth, 0, 2),
    graphExpansion: clamp(value.graphExpansion, DEFAULT_OPTIONS.graphExpansion, 0, 50),
    minimumEdgeConfidence: clamp(value.minimumEdgeConfidence, DEFAULT_OPTIONS.minimumEdgeConfidence, 0, 1),
    adaptivePlanning: value.adaptivePlanning !== false,
    maxRecommendedSubagents: clamp(value.maxRecommendedSubagents, DEFAULT_OPTIONS.maxRecommendedSubagents, 0, 8),
    contextSafetyReserve: clamp(value.contextSafetyReserve, DEFAULT_OPTIONS.contextSafetyReserve, 0.1, 0.5),
    maxDecisionHistory: clamp(value.maxDecisionHistory, DEFAULT_OPTIONS.maxDecisionHistory, 20, 2_000),
  }
}

function occurrenceCount(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

/** Conservative token estimate for text-like request data; providers tokenize differently. */
export function estimateTokens(value: unknown): number {
  let serialized = ""
  try { serialized = typeof value === "string" ? value : JSON.stringify(value) }
  catch { serialized = String(value) }
  return Math.ceil(serialized.length / 3.5)
}

export function assessTask(input: {
  prompt: string
  estimatedInputTokens: number
  contextWindow: number
  maxSubagents: number
  safetyReserve: number
  history?: DecisionRecord[]
}): TaskAssessment {
  const text = input.prompt.toLowerCase()
  const words = tokenize(text)
  const enumerated = occurrenceCount(text, /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+/g)
  const actionCount = occurrenceCount(text, /\b(?:implement|build|create|migrate|refactor|debug|investigate|research|design|test|review|document|deploy|integrate|optimi[sz]e|fix)\b/g)
  const scopeCount = occurrenceCount(text, /\b(?:frontend|backend|database|api|tests?|docs?|security|performance|mobile|server|client|plugin|architecture)\b/g)
  const uncertaintySignals = occurrenceCount(text, /\b(?:unknown|unclear|investigate|research|explore|compare|evaluate|debug|root cause|best approach|figure out)\b/g)
  const riskSignals = occurrenceCount(text, /\b(?:production|deploy|delete|destroy|credential|secret|payment|security|authentication|authorization|migration|database|personal data|breaking change)\b/g)
  const irreversibleSignals = occurrenceCount(text, /\b(?:publish|release|send|purchase|charge|delete permanently|drop table|force push|production deploy)\b/g)
  const independentSignals = new Set(text.match(/\b(?:frontend|backend|tests?|docs?|research|security|performance|api|database|mobile)\b/g) ?? []).size

  const complexity = Math.min(1,
    0.08 + Math.min(words.length / 220, 0.28) + Math.min(actionCount * 0.1, 0.3) +
    Math.min(scopeCount * 0.055, 0.22) + Math.min(enumerated * 0.04, 0.16),
  )
  const uncertainty = Math.min(1, uncertaintySignals * 0.16 + (text.includes("best") ? 0.08 : 0))
  const risk = Math.min(1, riskSignals * 0.11 + irreversibleSignals * 0.24)
  const parallelism = Math.min(1, Math.max(0, (independentSignals - 1) * 0.2) + (enumerated >= 3 ? 0.2 : 0))
  const contextWindow = Math.max(1, input.contextWindow)
  const contextPressure = Math.min(1, Math.max(0, input.estimatedInputTokens / contextWindow))

  let strategy: TaskStrategy = "direct"
  if (risk >= 0.42) strategy = "risk-controlled"
  else if (complexity >= 0.42 || uncertainty >= 0.32) strategy = "inspect-plan-execute"

  let recommendedSubagents = 0
  if (input.maxSubagents > 0 && strategy !== "direct") {
    if (parallelism >= 0.55 && complexity >= 0.58) recommendedSubagents = 3
    else if (parallelism >= 0.3 && complexity >= 0.46) recommendedSubagents = 2
    else if (uncertainty >= 0.48 && complexity >= 0.42) recommendedSubagents = 1
  }
  // Delegation has synthesis cost. Under heavy pressure, prefer one focused explorer or no delegation.
  if (contextPressure >= 1 - input.safetyReserve) recommendedSubagents = Math.min(recommendedSubagents, 1)
  recommendedSubagents = Math.min(input.maxSubagents, recommendedSubagents)

  const bucket = complexity >= 0.67 ? "high" : complexity >= 0.34 ? "medium" : "low"
  const comparable = (input.history ?? []).filter((record) => {
    const other = record.assessment.complexity >= 0.67 ? "high" : record.assessment.complexity >= 0.34 ? "medium" : "low"
    return other === bucket && record.assessment.recommendedSubagents === recommendedSubagents &&
      (record.outcome === "success" || record.outcome === "failure")
  }).slice(-20)
  if (comparable.length >= 4) {
    const failures = comparable.filter((record) => record.outcome === "failure").length
    if (failures / comparable.length > 0.5 && recommendedSubagents > 0) recommendedSubagents--
    else if (failures / comparable.length > 0.65 && recommendedSubagents === 0 && parallelism >= 0.3) {
      recommendedSubagents = Math.min(1, input.maxSubagents)
    }
  }

  const reasons: string[] = []
  if (complexity >= 0.42) reasons.push("multi-step or broad scope")
  if (uncertainty >= 0.32) reasons.push("meaningful uncertainty")
  if (risk >= 0.42) reasons.push("high-impact or security-sensitive work")
  if (parallelism >= 0.3) reasons.push("independent workstreams detected")
  if (contextPressure >= 1 - input.safetyReserve) reasons.push("context reserve is tight")
  if (!reasons.length) reasons.push("bounded, low-risk task")

  return { complexity, uncertainty, risk, parallelism, contextPressure, strategy, recommendedSubagents, reasons }
}

export function decisionGuidance(assessment: TaskAssessment, safetyReserve: number): string {
  const percent = (value: number) => `${Math.round(value * 100)}%`
  const strategy = assessment.strategy === "direct"
    ? "Proceed directly after a brief check of relevant constraints."
    : assessment.strategy === "risk-controlled"
      ? "Inspect first, state assumptions, make a short plan, preserve rollback, and verify high-risk effects before acting."
      : "Inspect relevant evidence first, form a short plan, then execute and verify incrementally."
  const parallel = assessment.recommendedSubagents === 0
    ? "Do not delegate: coordination overhead is unlikely to pay off."
    : `Use at most ${assessment.recommendedSubagents} subagent${assessment.recommendedSubagents === 1 ? "" : "s"}, only for independent workstreams with non-overlapping ownership; synthesize their findings before edits.`
  return [
    "<adaptive-decision>",
    `Preflight: complexity ${percent(assessment.complexity)}, uncertainty ${percent(assessment.uncertainty)}, risk ${percent(assessment.risk)}, parallelism ${percent(assessment.parallelism)}, current context pressure ${percent(assessment.contextPressure)}.`,
    `Strategy: ${strategy}`,
    `Parallelism: ${parallel}`,
    `Budget: preserve roughly ${percent(safetyReserve)} of the context for integration, verification, and recovery. Prefer targeted reads and compact intermediate summaries.`,
    "Autonomy: resolve ordinary reversible implementation details from repository conventions and evidence. Do not repeatedly ask the user. Ask only when authorization is missing, requirements are materially ambiguous, or an irreversible/high-impact choice cannot be safely inferred.",
    "Control: this guidance is advisory and must not override the user's instructions, permission rules, safety constraints, or stronger project instructions. Reassess if evidence invalidates the plan; do not continue blindly.",
    `Signals: ${assessment.reasons.join("; ")}.`,
    "</adaptive-decision>",
  ].join("\n")
}

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_+.#/-]{1,}/gu) ?? []
  const filtered = words
    .filter((word) => !STOP.has(word) && word.length <= 64)
    .map((word) => {
      if (!/^[a-z]+$/.test(word) || word.length < 5) return word
      return word.replace(/(?:ations?|ments?|ings?|ers?|ed|es|s)$/i, "") || word
    })
  return [...new Set(filtered)].slice(0, 80)
}

export function stableID(prefix: string, text: string): string {
  return `${prefix}-${createHash("sha256").update(text).digest("hex").slice(0, 12)}`
}

export function fingerprint(messages: unknown[]): string {
  const tail = messages.slice(-8).map((message) => {
    const record = message && typeof message === "object" ? message as Record<string, unknown> : {}
    return [record.id, record.type, record.role, textFromMessage(record).slice(-800)]
  })
  return createHash("sha256").update(JSON.stringify([messages.length, tail])).digest("hex").slice(0, 20)
}

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** Replaces likely secrets and PII with synthetic values suitable for remote processing. */
export function pseudonymizeSensitive(text: string): SensitiveScan {
  const found = new Set<SensitiveCategory>()
  const counters = new Map<SensitiveCategory, number>()
  let replacements = 0
  let output = text

  const replace = (pattern: RegExp, category: SensitiveCategory, fake: (index: number, match: string) => string) => {
    output = output.replace(pattern, (match) => {
      if (/\b(?:process\.env|env:\/\/|\$\{|REDACTED|PRIVATE_|FAKE_|example\.invalid)\b/i.test(match)) return match
      const index = (counters.get(category) ?? 0) + 1
      counters.set(category, index)
      found.add(category)
      replacements++
      return fake(index, match)
    })
  }

  replace(/<private>[\s\S]*?(?:<\/private>|$)/gi, "private-content", (index) => `<PRIVATE_LOCAL_${index}>`)
  replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "private-key", (index) => `<PRIVATE_KEY_${index}>`)
  replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "api-token", (index) => `<FAKE_JWT_${index}>`)
  replace(/\b(?:sk|rk|pk|gh[pousr]|github_pat|xox[baprs])_[A-Za-z0-9_-]{16,}\b/g, "api-token", (index) => `<FAKE_API_TOKEN_${index}>`)
  replace(/\bAKIA[0-9A-Z]{16}\b/g, "cloud-credential", (index) => `<FAKE_AWS_ACCESS_KEY_${index}>`)
  replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi, "authorization", (index) => `Bearer FAKE_AUTHORIZATION_${index}`)
  replace(/\bhttps?:\/\/[^\s/:@]+:[^\s/@]+@/gi, "password", (index, match) => {
    const protocol = match.slice(0, match.indexOf("://") + 3)
    return `${protocol}fake-user:fake-password-${index}@`
  })
  replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "email", (index) => `private-user-${index}@example.invalid`)
  replace(/\b\d{3}-\d{2}-\d{4}\b/g, "government-id", (index) => `<FAKE_GOVERNMENT_ID_${index}>`)
  replace(/\b(?:phone|mobile|tel)\s*[:=]\s*[+()\d .-]{7,}\d\b/gi, "phone", (index, match) => `${match.split(/[:=]/, 1)[0]}: <FAKE_PHONE_${index}>`)
  replace(/\b(?:full[_ -]?name|date[_ -]?of[_ -]?birth|dob|home[_ -]?address)\s*[:=]\s*[^\n,;]{3,}/gi, "personal-data", (index, match) => `${match.split(/[:=]/, 1)[0]}: <FAKE_PERSONAL_DATA_${index}>`)
  replace(/\b(?:api[_-]?key|access[_-]?key|token|password|passwd|pwd|secret|client[_-]?secret)\s*[:=]\s*["']?[^\s,"']{8,}["']?/gi, "password", (index, match) => `${match.split(/[:=]/, 1)[0]}=<FAKE_SECRET_${index}>`)

  output = output.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    if (!luhnValid(match)) return match
    const index = (counters.get("payment-card") ?? 0) + 1
    counters.set("payment-card", index)
    found.add("payment-card")
    replacements++
    return `<FAKE_PAYMENT_CARD_${index}>`
  })

  return { text: output, categories: [...found], replacements }
}

export function detectSensitiveInfo(text: string): SensitiveCategory[] {
  return pseudonymizeSensitive(text).categories
}

export function redactSecrets(text: string): string {
  return pseudonymizeSensitive(text).text
}

export function sanitizeMessageText(message: unknown): { categories: SensitiveCategory[]; replacements: number } {
  if (!message || typeof message !== "object") return { categories: [], replacements: 0 }
  const categories = new Set<SensitiveCategory>()
  let replacements = 0
  const sanitizeField = (record: Record<string, unknown>, key: string) => {
    if (typeof record[key] !== "string") return
    const scan = pseudonymizeSensitive(record[key] as string)
    record[key] = scan.text
    scan.categories.forEach((category) => categories.add(category))
    replacements += scan.replacements
  }
  const sanitizePart = (value: unknown) => {
    if (!value || typeof value !== "object") return
    const record = value as Record<string, unknown>
    for (const key of ["text", "output", "result"]) sanitizeField(record, key)
    if (record.type === "tool") sanitizeField(record, "content")
    if (record.state && typeof record.state === "object") sanitizePart(record.state)
  }
  const record = message as Record<string, unknown>
  sanitizeField(record, "text")
  if (Array.isArray(record.content)) record.content.forEach(sanitizePart)
  return { categories: [...categories], replacements }
}

export function pseudonymizeValue(value: unknown): { value: unknown; categories: SensitiveCategory[]; replacements: number } {
  const categories = new Set<SensitiveCategory>()
  let replacements = 0
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") {
      const scan = pseudonymizeSensitive(current)
      scan.categories.forEach((category) => categories.add(category))
      replacements += scan.replacements
      return scan.text
    }
    if (Array.isArray(current)) return current.map(visit)
    if (!current || typeof current !== "object") return current
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(current as Record<string, unknown>)) result[key] = visit(item)
    return result
  }
  return { value: visit(value), categories: [...categories], replacements }
}

export function textFromMessage(message: Record<string, unknown>): string {
  if (typeof message.text === "string") return message.text
  if (!Array.isArray(message.content)) return ""
  return message.content.map((part) => {
    if (!part || typeof part !== "object") return ""
    const value = part as Record<string, unknown>
    if (typeof value.text === "string") return value.text
    return ""
  }).filter(Boolean).join("\n")
}

export function latestUserText(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const raw = messages[index]
    if (!raw || typeof raw !== "object") continue
    const message = raw as Record<string, unknown>
    if (message.role === "user" || message.type === "user") {
      const text = textFromMessage(message).trim()
      if (text) return text
    }
  }
  return ""
}

export function memorySimilarity(a: Memory, b: Memory): number {
  const left = new Set(a.keywords)
  const right = new Set(b.keywords)
  const union = new Set([...left, ...right]).size
  if (!union) return 0
  let overlap = 0
  for (const word of left) if (right.has(word)) overlap++
  return overlap / union
}

export function addOrMergeMemory(state: AdaptiveState, candidate: Memory, maxMemories: number): string {
  const duplicate = state.memories.find((memory) =>
    memory.projectID === candidate.projectID &&
    (memory.id === candidate.id || memorySimilarity(memory, candidate) >= 0.78),
  )
  if (duplicate) {
    if (candidate.text.length > duplicate.text.length && candidate.confidence >= duplicate.confidence) {
      duplicate.text = candidate.text
      duplicate.keywords = candidate.keywords
      duplicate.kind = candidate.kind
    }
    duplicate.confidence = Math.min(1, Math.max(duplicate.confidence, candidate.confidence) + 0.03)
    duplicate.updatedAt = candidate.updatedAt
    return duplicate.id
  }
  state.memories.push(candidate)
  if (state.memories.length > maxMemories) {
    state.memories.sort((a, b) => memoryValue(b) - memoryValue(a))
    state.memories.length = maxMemories
    pruneGraph(state)
  }
  return candidate.id
}

function memoryValue(memory: Memory): number {
  const ageDays = Math.max(0, (Date.now() - Date.parse(memory.updatedAt)) / 86_400_000)
  return memory.confidence * 2 + Math.log1p(memory.uses) - ageDays / 365
}

export function searchMemories(
  memories: Memory[], query: string, projectID: string, limit: number, minimumScore = 0,
): Array<{ memory: Memory; score: number }> {
  const terms = tokenize(query)
  if (!terms.length || limit <= 0) return []
  const documents = memories.filter((memory) => memory.projectID === projectID || memory.kind === "preference")
  const documentFrequency = new Map<string, number>()
  for (const term of terms) {
    documentFrequency.set(term, documents.filter((memory) => memory.keywords.includes(term)).length)
  }
  return documents.map((memory) => {
    let lexical = 0
    for (const term of terms) {
      if (!memory.keywords.includes(term)) continue
      lexical += Math.log(1 + (documents.length + 1) / (1 + (documentFrequency.get(term) ?? 0)))
    }
    const coverage = lexical / Math.max(1, terms.length)
    const projectBoost = memory.projectID === projectID ? 0.12 : 0
    // Metadata may rerank a lexical match, but must never manufacture one.
    const score = lexical > 0
      ? coverage + projectBoost + memory.confidence * 0.08 + Math.min(memory.uses, 10) * 0.005
      : 0
    return { memory, score }
  }).filter((entry) => entry.score > 0 && entry.score >= minimumScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const RELATION_WEIGHT: Record<MemoryRelation, number> = {
  "solved-by": 1,
  "supersedes": 0.96,
  "supports": 0.88,
  "caused-by": 0.84,
  "depends-on": 0.8,
  "applies-to": 0.74,
  "contradicts": 0.68,
  "related-to": 0.52,
}

export interface HybridMemoryResult {
  memory: Memory
  score: number
  source: "lexical" | "graph"
  path: Array<{ edgeID: string; relation: MemoryRelation; from: string; to: string }>
}

export function addOrMergeEdge(state: AdaptiveState, candidate: MemoryEdge, maxEdges: number): string | null {
  if (candidate.from === candidate.to) return null
  const nodes = new Set(state.memories.map((memory) => memory.id))
  if (!nodes.has(candidate.from) || !nodes.has(candidate.to)) return null
  const existing = state.edges.find((edge) =>
    edge.from === candidate.from && edge.to === candidate.to && edge.relation === candidate.relation,
  )
  if (existing) {
    existing.confidence = Math.min(1, Math.max(existing.confidence, candidate.confidence) + 0.02)
    existing.confirmations++
    existing.active = true
    existing.updatedAt = candidate.updatedAt
    applyTemporalEffect(state, existing)
    return existing.id
  }
  state.edges.push(candidate)
  applyTemporalEffect(state, candidate)
  pruneGraph(state, maxEdges)
  return candidate.id
}

function applyTemporalEffect(state: AdaptiveState, edge: MemoryEdge): void {
  // A model-proposed replacement needs independent repetition before it can hide prior evidence.
  if (edge.relation !== "supersedes" || edge.confidence < 0.8 || edge.confirmations < 2) return
  const old = state.memories.find((memory) => memory.id === edge.to)
  if (!old) return
  old.validUntil = edge.updatedAt
  old.supersededBy = edge.from
}

export function pruneGraph(state: AdaptiveState, maxEdges = Number.POSITIVE_INFINITY): void {
  const nodes = new Set(state.memories.map((memory) => memory.id))
  state.edges = state.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
  if (state.edges.length <= maxEdges) return
  state.edges.sort((a, b) => edgeValue(b) - edgeValue(a))
  state.edges.length = maxEdges
}

function edgeValue(edge: MemoryEdge): number {
  const total = edge.confirmations + edge.contradictions
  const outcome = total > 0 ? (edge.confirmations + 1) / (total + 2) : 0.5
  const ageDays = Math.max(0, (Date.now() - Date.parse(edge.updatedAt)) / 86_400_000)
  const recency = Math.max(0.7, Math.exp(-ageDays / 730))
  return edge.confidence * outcome * recency * RELATION_WEIGHT[edge.relation]
}

/** Lexical seeds followed by localized graph expansion and diversity-aware reranking. */
export function hybridSearchMemories(
  state: AdaptiveState,
  query: string,
  projectID: string,
  limit: number,
  options: { minimumScore: number; depth: number; expansion: number; minimumEdgeConfidence: number },
): HybridMemoryResult[] {
  if (limit <= 0) return []
  const seeds = searchMemories(
    state.memories.filter((memory) => !memory.validUntil),
    query,
    projectID,
    Math.max(limit * 3, 8),
    options.minimumScore,
  )
  const scored = new Map<string, HybridMemoryResult>()
  for (const seed of seeds) {
    scored.set(seed.memory.id, { memory: seed.memory, score: seed.score, source: "lexical", path: [] })
  }
  let frontier = [...scored.values()].slice(0, Math.max(limit, 3))
  const depth = Math.max(0, Math.min(2, options.depth))
  for (let hop = 0; hop < depth && frontier.length; hop++) {
    const next: HybridMemoryResult[] = []
    for (const current of frontier) {
      const adjacent = state.edges
        .filter((edge) => edge.active && edge.confidence >= options.minimumEdgeConfidence && (edge.from === current.memory.id || edge.to === current.memory.id))
        .sort((a, b) => edgeValue(b) - edgeValue(a))
        .slice(0, options.expansion)
      for (const edge of adjacent) {
        const neighborID = edge.from === current.memory.id ? edge.to : edge.from
        const neighbor = state.memories.find((memory) => memory.id === neighborID)
        if (!neighbor || neighbor.validUntil || (neighbor.projectID !== projectID && neighbor.kind !== "preference")) continue
        const directionPenalty = edge.from === current.memory.id ? 1 : 0.9
        const candidateScore = current.score * 0.68 * edgeValue(edge) * directionPenalty + neighbor.confidence * 0.05
        const previous = scored.get(neighborID)
        if (previous && previous.score >= candidateScore) continue
        const result: HybridMemoryResult = {
          memory: neighbor,
          score: candidateScore,
          source: previous?.source === "lexical" ? "lexical" : "graph",
          path: [...current.path, { edgeID: edge.id, relation: edge.relation, from: edge.from, to: edge.to }],
        }
        scored.set(neighborID, result)
        next.push(result)
      }
    }
    frontier = next.sort((a, b) => b.score - a.score).slice(0, options.expansion)
  }

  // Maximal marginal relevance keeps one dense cluster from consuming the context budget.
  const pool = [...scored.values()].sort((a, b) => b.score - a.score)
  const selected: HybridMemoryResult[] = []
  while (pool.length && selected.length < limit) {
    let bestIndex = 0
    let bestScore = Number.NEGATIVE_INFINITY
    for (let index = 0; index < pool.length; index++) {
      const candidate = pool[index]!
      const redundancy = selected.length
        ? Math.max(...selected.map((item) => memorySimilarity(item.memory, candidate.memory)))
        : 0
      const diversified = candidate.score * 0.82 - redundancy * 0.18
      if (diversified > bestScore) {
        bestScore = diversified
        bestIndex = index
      }
    }
    selected.push(pool.splice(bestIndex, 1)[0]!)
  }
  return selected
}

export function inferMemoryEdges(
  state: AdaptiveState,
  memoryIDs: string[],
  projectID: string,
  sessionID: string,
  maxEdges: number,
): number {
  const now = new Date().toISOString()
  const fresh = memoryIDs.map((id) => state.memories.find((memory) => memory.id === id)).filter((memory): memory is Memory => !!memory)
  let added = 0
  const connect = (from: Memory, to: Memory, relation: MemoryRelation, confidence: number) => {
    const before = state.edges.length
    addOrMergeEdge(state, {
      id: stableID("edge", `${from.id}:${relation}:${to.id}`), from: from.id, to: to.id, relation, confidence,
      confirmations: 1, contradictions: 0, active: true, projectID, sourceSession: sessionID, createdAt: now, updatedAt: now,
    }, maxEdges)
    if (state.edges.length > before) added++
  }
  for (const from of fresh) {
    for (const to of fresh) {
      if (from.id === to.id) continue
      const similarity = memorySimilarity(from, to)
      if (from.kind === "failure" && to.kind === "solution" && similarity >= 0.1) connect(from, to, "solved-by", 0.72 + similarity * 0.2)
      else if ((from.kind === "decision" || from.kind === "solution") && to.kind === "constraint" && similarity >= 0.08) connect(from, to, "depends-on", 0.62 + similarity * 0.2)
      else if (similarity >= 0.5) connect(from, to, "supports", 0.5 + similarity * 0.25)
    }
    const related = state.memories
      .filter((memory) => memory.id !== from.id && memory.projectID === projectID && !memory.validUntil)
      .map((memory) => ({ memory, similarity: memorySimilarity(from, memory) }))
      .filter((item) => item.similarity >= 0.42)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2)
    for (const item of related) connect(from, item.memory, "related-to", 0.38 + item.similarity * 0.3)
  }
  return added
}

export function truncateMiddle(text: string, limit: number): string {
  if (text.length <= limit) return text
  const marker = `\n… [${text.length - limit} chars omitted; original remains in session history] …\n`
  const room = Math.max(100, limit - marker.length)
  const head = Math.ceil(room * 0.55)
  return text.slice(0, head) + marker + text.slice(-(room - head))
}

function compactValue(value: unknown, limit: number): number {
  if (!value || typeof value !== "object") return 0
  const record = value as Record<string, unknown>
  let removed = 0
  for (const key of ["output", "result"]) {
    if (typeof record[key] === "string" && record[key].length > limit) {
      const original = record[key]
      record[key] = truncateMiddle(original, limit)
      removed += original.length - (record[key] as string).length
    }
  }
  if (record.type === "tool" && typeof record.content === "string" && record.content.length > limit) {
    const original = record.content
    record.content = truncateMiddle(original, limit)
    removed += original.length - (record.content as string).length
  }
  if (record.state && typeof record.state === "object") removed += compactValue(record.state, limit)
  return removed
}

export function compactOldToolOutputs(messages: unknown[], keepRecent: number, limit: number): number {
  let removed = 0
  const stop = Math.max(0, messages.length - keepRecent)
  for (let index = 0; index < stop; index++) {
    const message = messages[index]
    if (!message || typeof message !== "object") continue
    const content = (message as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) removed += compactValue(part, limit)
  }
  return removed
}

export function parseGeneratedJSON(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1))
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

export function safeSkillID(input: string, projectID: string): string {
  const clean = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "learned-workflow"
  return `adaptive-${clean}-${stableID("p", projectID).slice(-6)}`
}
