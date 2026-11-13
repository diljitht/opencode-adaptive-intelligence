import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

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
  /** Last time the memory text itself changed. */
  contentUpdatedAt?: string
  /** Last time the memory was injected into model context. */
  lastAccessedAt?: string
  /** Last time independent verification supported this memory. */
  lastConfirmedAt?: string
  updatedAt: string
  sourceSession?: string
  /** Bounded references to the checkpoints or manual writes that support it. */
  sourceRefs?: string[]
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
  /** Distinct sessions/checkpoints that independently supported this edge. */
  confirmationRefs?: string[]
  createdAt: string
  updatedAt: string
}

export type SkillTier = "common" | "project"

export interface SkillHistoryEntry {
  version: number
  at: string
  note: string
}

export interface LearnedSkill {
  id: string
  name: string
  description: string
  content: string
  triggerTerms: string[]
  /** Project that first learned the skill. */
  projectID: string
  version: number
  uses: number
  successes: number
  failures: number
  createdAt: string
  updatedAt: string
  evidenceMemoryIDs?: string[]
  /** Applicability tags (project genres) used to surface the skill in similar projects. */
  tags?: string[]
  /** "common" = broadly useful and continuously refined; "project" = niche or project-specific. */
  tier?: SkillTier
  /** Projects where this skill has been learned, adopted, or used. */
  projectIDs?: string[]
  /** Short log of distilled improvements, newest last. */
  history?: SkillHistoryEntry[]
}

/** A skill selected from the shared library for the current project. */
export interface LibrarySkillCandidate {
  skill: LearnedSkill
  score: number
  reason: SkillTier
  similarity: number
}

/** Manifest for the common skill folder shared by every project. */
export interface LibraryIndex {
  version: 1
  updatedAt: string
  skills: LearnedSkill[]
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
  /** Message index where this task's user turn begins. */
  taskStartMessageIndex?: number
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
    librarySkills: number
    libraryAdopted: number
    libraryRefinements: number
    persistenceErrors: number
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
  maxTotalMemories: number
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
  /** Share learned skills through one common library folder across projects. */
  sharedSkills: boolean
  /** Permit preference memories to be recalled outside their source project. */
  crossProjectPreferences: boolean
  /** Minimum similarity before a learned procedure is merged into an existing skill. */
  skillSimilarityThreshold: number
  /** Uses across at least this many projects promote a skill to the common tier. */
  commonSkillMinProjects: number
  /** Successful uses that promote a skill to the common tier. */
  commonSkillMinUses: number
  /** Verified outcomes required before a skill can leave its origin project. */
  minimumSkillVerifiedSuccesses: number
  /** Minimum verified success ratio required for cross-project skill use. */
  minimumSkillSuccessRate: number
  /** Extra genre tags for this project, merged with tags detected from the project directory. */
  projectTags: string[]
}

export const DEFAULT_OPTIONS: PluginOptions = {
  enabled: true,
  autoLearn: true,
  autoSkills: true,
  tokenOptimization: true,
  minimumMessages: 6,
  minimumNewMessages: 4,
  maxMemories: 200,
  maxTotalMemories: 2_000,
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
  sharedSkills: true,
  crossProjectPreferences: false,
  skillSimilarityThreshold: 0.34,
  commonSkillMinProjects: 2,
  commonSkillMinUses: 3,
  minimumSkillVerifiedSuccesses: 2,
  minimumSkillSuccessRate: 0.75,
  projectTags: [],
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
      librarySkills: 0,
      libraryAdopted: 0,
      libraryRefinements: 0,
      persistenceErrors: 0,
    },
  }
}

/**
 * Rebuild a stats record from persisted state, keeping only the counters this
 * version understands. This drops stale keys left behind by earlier versions
 * while preserving any accumulated values for the current counters.
 */
export function normalizeStats(raw: unknown): AdaptiveState["stats"] {
  const stats = emptyState().stats
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return stats
  const record = raw as Record<string, unknown>
  for (const key of Object.keys(stats) as Array<keyof AdaptiveState["stats"]>) {
    const parsed = Number(record[key])
    if (Number.isFinite(parsed) && parsed >= 0) stats[key] = parsed
  }
  return stats
}

/** Validate persisted state before it is used by hooks or filesystem writers. */
export function normalizeAdaptiveState(raw: unknown): AdaptiveState {
  const state = emptyState()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return state
  const record = raw as Record<string, unknown>
  const validDate = (value: unknown, fallback: string): string =>
    typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback
  const memoryKinds = new Set<MemoryKind>(["preference", "decision", "constraint", "fact", "failure", "solution"])
  const relations = new Set<MemoryRelation>([
    "supports", "contradicts", "caused-by", "solved-by", "supersedes", "depends-on", "applies-to", "related-to",
  ])
  const now = new Date().toISOString()

  if (Array.isArray(record.memories)) {
    for (const rawMemory of record.memories.slice(0, 20_000)) {
      if (!rawMemory || typeof rawMemory !== "object" || Array.isArray(rawMemory)) continue
      const item = rawMemory as Record<string, unknown>
      const id = typeof item.id === "string" ? item.id.slice(0, 100) : ""
      const text = typeof item.text === "string" ? item.text.slice(0, 1_000) : ""
      const kind = item.kind as MemoryKind
      const projectID = typeof item.projectID === "string" ? item.projectID.slice(0, 200) : ""
      if (!id || !text || !projectID || !memoryKinds.has(kind)) continue
      const createdAt = validDate(item.createdAt, now)
      state.memories.push({
        id, text, kind, projectID,
        keywords: Array.isArray(item.keywords)
          ? item.keywords.filter((value): value is string => typeof value === "string").slice(0, 80)
          : tokenize(text),
        confidence: clamp(item.confidence, 0.5, 0, 1),
        uses: Math.floor(clamp(item.uses, 0, 0, 1_000_000)),
        createdAt,
        contentUpdatedAt: item.contentUpdatedAt ? validDate(item.contentUpdatedAt, createdAt) : undefined,
        lastAccessedAt: item.lastAccessedAt ? validDate(item.lastAccessedAt, createdAt) : undefined,
        lastConfirmedAt: item.lastConfirmedAt ? validDate(item.lastConfirmedAt, createdAt) : undefined,
        updatedAt: validDate(item.updatedAt, createdAt),
        sourceSession: typeof item.sourceSession === "string" ? item.sourceSession.slice(0, 200) : undefined,
        sourceRefs: stringList(item.sourceRefs, 20),
        validFrom: item.validFrom ? validDate(item.validFrom, createdAt) : undefined,
        validUntil: item.validUntil ? validDate(item.validUntil, createdAt) : undefined,
        supersededBy: typeof item.supersededBy === "string" ? item.supersededBy.slice(0, 100) : undefined,
      })
    }
  }

  const memoryIDs = new Set(state.memories.map((memory) => memory.id))
  if (Array.isArray(record.edges)) {
    for (const rawEdge of record.edges.slice(0, 100_000)) {
      if (!rawEdge || typeof rawEdge !== "object" || Array.isArray(rawEdge)) continue
      const item = rawEdge as Record<string, unknown>
      const id = typeof item.id === "string" ? item.id.slice(0, 100) : ""
      const from = typeof item.from === "string" ? item.from.slice(0, 100) : ""
      const to = typeof item.to === "string" ? item.to.slice(0, 100) : ""
      const relation = item.relation as MemoryRelation
      if (!id || from === to || !memoryIDs.has(from) || !memoryIDs.has(to) || !relations.has(relation)) continue
      const createdAt = validDate(item.createdAt, now)
      state.edges.push({
        id, from, to, relation,
        confidence: clamp(item.confidence, 0.5, 0, 1),
        confirmations: Math.floor(clamp(item.confirmations, 0, 0, 1_000_000)),
        contradictions: Math.floor(clamp(item.contradictions, 0, 0, 1_000_000)),
        active: item.active !== false,
        projectID: typeof item.projectID === "string" ? item.projectID.slice(0, 200) : "",
        sourceSession: typeof item.sourceSession === "string" ? item.sourceSession.slice(0, 200) : undefined,
        confirmationRefs: stringList(item.confirmationRefs, 20),
        createdAt,
        updatedAt: validDate(item.updatedAt, createdAt),
      })
    }
  }

  state.skills = parseLibraryIndex({ version: 1, skills: record.skills }).skills
  if (Array.isArray(record.decisions)) {
    for (const rawDecision of record.decisions.slice(-2_000)) {
      if (!rawDecision || typeof rawDecision !== "object" || Array.isArray(rawDecision)) continue
      const item = rawDecision as Record<string, unknown>
      const assessment = item.assessment && typeof item.assessment === "object"
        ? item.assessment as Record<string, unknown>
        : {}
      const id = typeof item.id === "string" ? item.id.slice(0, 100) : ""
      const sessionID = typeof item.sessionID === "string" ? item.sessionID.slice(0, 200) : ""
      if (!id || !sessionID) continue
      const createdAt = validDate(item.createdAt, now)
      const strategy: TaskStrategy = assessment.strategy === "risk-controlled" || assessment.strategy === "inspect-plan-execute"
        ? assessment.strategy
        : "direct"
      const outcome: DecisionOutcome = item.outcome === "success" || item.outcome === "failure" ||
        item.outcome === "inconclusive" ? item.outcome : "pending"
      state.decisions.push({
        id, sessionID,
        taskFingerprint: typeof item.taskFingerprint === "string" ? item.taskFingerprint.slice(0, 100) : id,
        taskStartMessageIndex: Math.floor(clamp(item.taskStartMessageIndex, 0, 0, 1_000_000)),
        assessment: {
          complexity: clamp(assessment.complexity, 0, 0, 1),
          uncertainty: clamp(assessment.uncertainty, 0, 0, 1),
          risk: clamp(assessment.risk, 0, 0, 1),
          parallelism: clamp(assessment.parallelism, 0, 0, 1),
          contextPressure: clamp(assessment.contextPressure, 0, 0, 1),
          strategy,
          recommendedSubagents: Math.floor(clamp(assessment.recommendedSubagents, 0, 0, 8)),
          reasons: stringList(assessment.reasons, 12),
        },
        actualSubagents: Math.floor(clamp(item.actualSubagents, 0, 0, 100)),
        outcome,
        createdAt,
        updatedAt: validDate(item.updatedAt, createdAt),
      })
    }
  }

  if (record.sessions && typeof record.sessions === "object" && !Array.isArray(record.sessions)) {
    for (const [sessionID, rawCheckpoint] of Object.entries(record.sessions as Record<string, unknown>).slice(-300)) {
      if (!rawCheckpoint || typeof rawCheckpoint !== "object" || Array.isArray(rawCheckpoint)) continue
      const item = rawCheckpoint as Record<string, unknown>
      if (typeof item.fingerprint !== "string") continue
      state.sessions[sessionID.slice(0, 200)] = {
        fingerprint: item.fingerprint.slice(0, 100),
        messageCount: Math.floor(clamp(item.messageCount, 0, 0, 1_000_000)),
        extractionCount: Math.floor(clamp(item.extractionCount, 0, 0, 1_000_000)),
        updatedAt: validDate(item.updatedAt, now),
      }
    }
  }
  state.stats = normalizeStats(record.stats)
  return state
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
    maxTotalMemories: clamp(value.maxTotalMemories, DEFAULT_OPTIONS.maxTotalMemories, 100, 20_000),
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
    sharedSkills: value.sharedSkills !== false && value.crossProjectSkills !== false,
    crossProjectPreferences: value.crossProjectPreferences === true,
    skillSimilarityThreshold: clamp(value.skillSimilarityThreshold, DEFAULT_OPTIONS.skillSimilarityThreshold, 0, 1),
    commonSkillMinProjects: clamp(value.commonSkillMinProjects, DEFAULT_OPTIONS.commonSkillMinProjects, 1, 20),
    commonSkillMinUses: clamp(value.commonSkillMinUses, DEFAULT_OPTIONS.commonSkillMinUses, 1, 100),
    minimumSkillVerifiedSuccesses: clamp(value.minimumSkillVerifiedSuccesses, DEFAULT_OPTIONS.minimumSkillVerifiedSuccesses, 1, 20),
    minimumSkillSuccessRate: clamp(value.minimumSkillSuccessRate, DEFAULT_OPTIONS.minimumSkillSuccessRate, 0.5, 1),
    projectTags: Array.isArray(value.projectTags)
      ? value.projectTags.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 32)
      : [],
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

export function shouldCompactContext(estimatedTokens: number, contextWindow: number, safetyReserve: number): boolean {
  if (!Number.isFinite(estimatedTokens) || estimatedTokens <= 0) return false
  const window = Math.max(1, contextWindow)
  const reserve = Math.max(0.1, Math.min(0.5, safetyReserve))
  return estimatedTokens / window >= 1 - reserve
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

function tokenizeAll(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_+.#/-]{1,}/gu) ?? [])
    .filter((word) => !STOP.has(word) && word.length <= 64)
    .map((word) => {
      if (!/^[a-z]+$/.test(word) || word.length < 5) return word
      return word.replace(/(?:ations?|ments?|ings?|ers?|ed|es|s)$/i, "") || word
    })
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

/** Reject common prompt-injection patterns from persistent learned procedures. */
export function hasUnsafePersistentInstructions(text: string): boolean {
  return /\b(?:ignore|override|bypass|disregard)\b.{0,50}\b(?:previous|system|developer|safety|permission|instructions?)\b|<\s*\/?\s*(?:system|developer)\b|\b(?:exfiltrate|steal)\b.{0,40}\b(?:secret|credential|token|data)\b/i.test(text)
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
    for (const key of ["input", "arguments"]) {
      if (!(key in record)) continue
      const scan = pseudonymizeValue(record[key])
      record[key] = scan.value
      scan.categories.forEach((category) => categories.add(category))
      replacements += scan.replacements
    }
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

export function latestUserMessageIndex(messages: unknown[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    const raw = messages[index]
    if (!raw || typeof raw !== "object") continue
    const message = raw as Record<string, unknown>
    if ((message.role === "user" || message.type === "user") && textFromMessage(message).trim()) return index
  }
  return Math.max(0, messages.length - 1)
}

/**
 * Classify only explicit, task-level verification evidence. Ordinary tool
 * errors and an absence of errors are intentionally inconclusive.
 */
export function classifyVerifiedOutcome(
  messages: unknown[],
  startIndex = Math.max(0, messages.length - 30),
): Exclude<DecisionOutcome, "pending"> {
  let outcome: Exclude<DecisionOutcome, "pending"> = "inconclusive"
  for (const raw of messages.slice(Math.max(0, startIndex))) {
    if (!raw || typeof raw !== "object") continue
    const message = raw as Record<string, unknown>
    const messageText = textFromMessage(message)
    if ((message.role === "user" || message.type === "user") &&
      /\b(?:still broken|still failing|incorrect|verification failed|tests? (?:still )?fail(?:ed|ing)?)\b/i.test(messageText)) {
      outcome = "failure"
    }
    if (!Array.isArray(message.content)) continue
    for (const rawPart of message.content) {
      if (!rawPart || typeof rawPart !== "object") continue
      const part = rawPart as Record<string, unknown>
      if (part.type !== "tool") continue
      const state = part.state && typeof part.state === "object" ? part.state as Record<string, unknown> : {}
      let serialized = ""
      try { serialized = JSON.stringify({ tool: part.tool ?? part.name, input: part.input, state }) }
      catch { serialized = `${part.tool ?? part.name ?? ""} ${state.output ?? state.result ?? ""}` }
      const isVerification = /\b(?:test|vitest|jest|pytest|cargo test|go test|typecheck|tsc|build|lint|verify|check)\b/i.test(serialized)
      if (!isVerification) continue
      const output = `${state.output ?? ""} ${state.result ?? ""}`
      const exitCode = Number(
        state.exitCode ??
        (state.metadata && typeof state.metadata === "object"
          ? (state.metadata as Record<string, unknown>).exitCode
          : Number.NaN),
      )
      if (state.status === "error" || /\b(?:tests? failed|verification failed|[1-9]\d* failures?|exit code [1-9]\d*)\b/i.test(output)) {
        outcome = "failure"
      } else if (state.status === "completed" && (
        exitCode === 0 ||
        /\b(?:tests? passed|verification passed|build (?:passed|succeeded)|typecheck passed|0 failures?|exit code 0|success)\b/i.test(output) ||
        /(?:^|\n)\s*#\s*pass\s+[1-9]\d*\b/i.test(output) ||
        /\b[1-9]\d*\s+passed(?:,\s*\d+\s+(?:skipped|deselected))?\b/i.test(output) ||
        /\bTests:\s*(?:\d+\s+skipped,\s*)?\d+\s+passed\b/i.test(output) ||
        /\btest result:\s*ok\b/i.test(output) ||
        /(?:^|\n)\s*ok\s+(?:\S+\/)*\S+/i.test(output)
      )) {
        outcome = "success"
      }
    }
  }
  return outcome
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

const NEGATION = new Set(["avoid", "cannot", "disable", "disabled", "dont", "never", "no", "not", "prohibit", "without"])

function memoryPolarity(memory: Memory): -1 | 1 {
  return tokenize(memory.text).some((token) => NEGATION.has(token)) ? -1 : 1
}

/** Conservative lexical contradiction guard used before deduplication. */
export function memoriesContradict(a: Memory, b: Memory): boolean {
  if (a.projectID !== b.projectID || memoryPolarity(a) === memoryPolarity(b)) return false
  const strip = (memory: Memory) => new Set(memory.keywords.filter((token) => !NEGATION.has(token)))
  const left = strip(a)
  const right = strip(b)
  if (!left.size || !right.size) return false
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.min(left.size, right.size) >= 0.6
}

export function addOrMergeMemory(
  state: AdaptiveState,
  candidate: Memory,
  maxMemoriesPerProject: number,
  maxTotalMemories = Number.POSITIVE_INFINITY,
): string {
  const duplicate = state.memories.find((memory) =>
    memory.projectID === candidate.projectID &&
    !memoriesContradict(memory, candidate) &&
    (memory.id === candidate.id || memorySimilarity(memory, candidate) >= 0.78),
  )
  if (duplicate) {
    const previousRefs = new Set(duplicate.sourceRefs ?? [])
    const incomingRefs = candidate.sourceRefs ?? []
    const hasNewEvidence = incomingRefs.some((ref) => !previousRefs.has(ref))
    if (candidate.text.length > duplicate.text.length && candidate.confidence >= duplicate.confidence) {
      duplicate.text = candidate.text
      duplicate.keywords = candidate.keywords
      duplicate.kind = candidate.kind
      duplicate.contentUpdatedAt = candidate.contentUpdatedAt ?? candidate.updatedAt
    }
    duplicate.confidence = Math.min(
      1,
      Math.max(duplicate.confidence, candidate.confidence) + (hasNewEvidence ? 0.03 : 0),
    )
    duplicate.updatedAt = candidate.updatedAt
    duplicate.lastConfirmedAt = candidate.lastConfirmedAt ?? duplicate.lastConfirmedAt
    duplicate.sourceRefs = [...new Set([...(duplicate.sourceRefs ?? []), ...(candidate.sourceRefs ?? [])])].slice(-20)
    return duplicate.id
  }
  state.memories.push(candidate)
  const projectMemories = state.memories.filter((memory) => memory.projectID === candidate.projectID)
  if (projectMemories.length > maxMemoriesPerProject) {
    const keep = new Set(projectMemories.sort((a, b) => memoryValue(b) - memoryValue(a)).slice(0, maxMemoriesPerProject).map((memory) => memory.id))
    state.memories = state.memories.filter((memory) => memory.projectID !== candidate.projectID || keep.has(memory.id))
  }
  if (state.memories.length > maxTotalMemories) {
    state.memories.sort((a, b) => memoryValue(b) - memoryValue(a))
    state.memories.length = maxTotalMemories
    pruneGraph(state)
  }
  return candidate.id
}

function memoryValue(memory: Memory): number {
  const contentDate = memory.lastConfirmedAt ?? memory.contentUpdatedAt ?? memory.updatedAt
  const ageDays = Math.max(0, (Date.now() - Date.parse(contentDate)) / 86_400_000)
  return memory.confidence * 2 + Math.log1p(memory.uses) - ageDays / 365
}

export function searchMemories(
  memories: Memory[], query: string, projectID: string, limit: number, minimumScore = 0,
  includeCrossProjectPreferences = false,
): Array<{ memory: Memory; score: number }> {
  const terms = tokenize(query)
  if (!terms.length || limit <= 0) return []
  const documents = memories.filter((memory) =>
    memory.projectID === projectID || (includeCrossProjectPreferences && memory.kind === "preference"),
  )
  const documentTokens = new Map(documents.map((memory) => [memory.id, tokenizeAll(memory.text)]))
  const averageLength = documents.length
    ? [...documentTokens.values()].reduce((sum, tokens) => sum + tokens.length, 0) / documents.length
    : 1
  const documentFrequency = new Map<string, number>()
  for (const term of terms) {
    documentFrequency.set(term, documents.filter((memory) => (documentTokens.get(memory.id) ?? []).includes(term)).length)
  }
  return documents.map((memory) => {
    let lexical = 0
    const tokens = documentTokens.get(memory.id) ?? []
    const length = Math.max(1, tokens.length)
    for (const term of terms) {
      const frequency = tokens.filter((token) => token === term).length
      if (!frequency) continue
      const df = documentFrequency.get(term) ?? 0
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5))
      const k1 = 1.2
      const b = 0.75
      lexical += idf * (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * length / Math.max(1, averageLength)))
    }
    const coverage = lexical / Math.max(1, terms.length)
    const normalizedQuery = terms.join(" ")
    const normalizedText = tokens.join(" ")
    const phraseBoost = normalizedQuery.length >= 4 && normalizedText.includes(normalizedQuery) ? 0.3 : 0
    const identifierBoost = terms.some((term) => /[./_+-]/.test(term) && memory.text.toLowerCase().includes(term)) ? 0.2 : 0
    const projectBoost = memory.projectID === projectID ? 0.12 : 0
    // Metadata may rerank a lexical match, but must never manufacture one.
    const score = lexical > 0
      ? coverage + phraseBoost + identifierBoost + projectBoost + memory.confidence * 0.08 + Math.min(memory.uses, 10) * 0.005
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
    const reference = candidate.confirmationRefs?.[0] ?? candidate.sourceSession
    const known = new Set(existing.confirmationRefs ?? (existing.sourceSession ? [existing.sourceSession] : []))
    const independentlyConfirmed = !reference || !known.has(reference)
    if (independentlyConfirmed) {
      existing.confidence = Math.min(1, Math.max(existing.confidence, candidate.confidence) + 0.02)
      existing.confirmations++
      if (reference) existing.confirmationRefs = [...known, reference].slice(-20)
    }
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
  options: {
    minimumScore: number
    depth: number
    expansion: number
    minimumEdgeConfidence: number
    includeCrossProjectPreferences?: boolean
  },
): HybridMemoryResult[] {
  if (limit <= 0) return []
  const seeds = searchMemories(
    state.memories.filter((memory) => !memory.validUntil),
    query,
    projectID,
    Math.max(limit * 3, 8),
    options.minimumScore,
    options.includeCrossProjectPreferences === true,
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
        if (!neighbor || neighbor.validUntil || (
          neighbor.projectID !== projectID &&
          !(options.includeCrossProjectPreferences && neighbor.kind === "preference")
        )) continue
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
      confirmations: 1, contradictions: 0, active: true, projectID, sourceSession: sessionID,
      confirmationRefs: [sessionID], createdAt: now, updatedAt: now,
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

/** Stable, project-independent identifier for a skill in the common library. */
export function librarySkillID(input: string): string {
  const clean = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "learned-workflow"
  return `adaptive-${clean}`
}

/** Restrict filesystem-backed skill IDs to portable, path-safe identifiers. */
export function isValidLibrarySkillID(id: string): boolean {
  return id.length <= 64 && /^adaptive-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
}

/** Token-overlap (Jaccard) similarity between two free-text fields; 0 when either is empty. */
export function textSimilarity(left: string, right: string): number {
  const a = new Set(tokenize(left))
  const b = new Set(tokenize(right))
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  const union = new Set([...a, ...b]).size
  return union ? shared / union : 0
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, max)
    : []
}

function nonNegative(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// ---------------------------------------------------------------------------
// Common skill library
//
// Every project reads and writes one shared library folder. Learned procedures
// are distilled into existing entries instead of duplicated, broadly useful
// skills are promoted to the "common" tier, and project-specific skills stay
// available to projects whose genre tags match. Nothing leaves the machine.
// ---------------------------------------------------------------------------

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function readTextFile(file: string, max = 400_000): string {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size > max) return ""
    return fs.readFileSync(file, "utf8")
  } catch {
    return ""
  }
}

function listEntries(directory: string): string[] {
  try {
    return fs.readdirSync(directory)
  } catch {
    return []
  }
}

function isDirectory(directory: string, relative: string): boolean {
  try {
    return fs.statSync(path.join(directory, relative)).isDirectory()
  } catch {
    return false
  }
}

const JAVASCRIPT_DEPENDENCY_TAGS: Record<string, string[]> = {
  react: ["react", "web"],
  "react-dom": ["react", "web"],
  next: ["nextjs", "web", "ssr"],
  vue: ["vue", "web"],
  nuxt: ["nuxt", "web", "ssr"],
  svelte: ["svelte", "web"],
  "@sveltejs/kit": ["svelte", "web", "ssr"],
  "@angular/core": ["angular", "web"],
  "solid-js": ["solid", "web"],
  astro: ["astro", "web"],
  electron: ["electron", "desktop"],
  express: ["express", "server", "http"],
  fastify: ["fastify", "server", "http"],
  koa: ["koa", "server", "http"],
  "@nestjs/core": ["nestjs", "server"],
  prisma: ["prisma", "database"],
  "@prisma/client": ["prisma", "database"],
  tailwindcss: ["tailwind", "css"],
  vite: ["vite", "build"],
  webpack: ["webpack", "build"],
  rollup: ["rollup", "build"],
  esbuild: ["esbuild", "build"],
  jest: ["jest", "testing"],
  vitest: ["vitest", "testing"],
  mocha: ["mocha", "testing"],
  "@playwright/test": ["playwright", "testing"],
  playwright: ["playwright", "testing"],
  cypress: ["cypress", "testing"],
  typescript: ["typescript"],
  eslint: ["eslint", "lint"],
  graphql: ["graphql", "api"],
  "@apollo/client": ["graphql", "api"],
  "socket.io": ["realtime"],
  d3: ["visualization"],
  three: ["3d", "graphics"],
  mongodb: ["mongodb", "database"],
  mongoose: ["mongodb", "database"],
  pg: ["postgres", "database"],
  postgres: ["postgres", "database"],
  mysql2: ["mysql", "database"],
  redis: ["redis", "cache"],
  ioredis: ["redis", "cache"],
  "@supabase/supabase-js": ["supabase", "backend"],
  firebase: ["firebase", "backend"],
  stripe: ["stripe", "payments"],
  "@modelcontextprotocol/sdk": ["mcp"],
  openai: ["ai", "llm"],
  "@anthropic-ai/sdk": ["ai", "llm"],
  langchain: ["ai", "llm"],
  "@opencode-ai/sdk": ["opencode"],
  "@opencode/plugin": ["opencode", "plugin"],
  "react-native": ["react-native", "mobile"],
  expo: ["expo", "mobile"],
  "discord.js": ["discord", "bot"],
  telegraf: ["telegram", "bot"],
  grammy: ["telegram", "bot"],
}

const PYTHON_DEPENDENCY_TAGS: Record<string, string[]> = {
  django: ["django", "web"],
  flask: ["flask", "web"],
  fastapi: ["fastapi", "api"],
  starlette: ["starlette", "api"],
  pandas: ["pandas", "data"],
  numpy: ["numpy", "data"],
  scipy: ["scipy", "data"],
  torch: ["pytorch", "ml"],
  tensorflow: ["tensorflow", "ml"],
  "scikit-learn": ["sklearn", "ml"],
  sklearn: ["sklearn", "ml"],
  scrapy: ["scrapy", "scraping"],
  celery: ["celery", "tasks"],
  sqlalchemy: ["sqlalchemy", "database"],
  pydantic: ["pydantic"],
  pytest: ["pytest", "testing"],
  streamlit: ["streamlit", "web"],
  matplotlib: ["matplotlib", "visualization"],
  jupyter: ["jupyter", "notebook"],
  transformers: ["transformers", "ml"],
  langchain: ["langchain", "ai", "llm"],
}

const GO_DEPENDENCY_TAGS: Record<string, string[]> = {
  "gin-gonic/gin": ["gin", "web"],
  "labstack/echo": ["echo", "web"],
  "gofiber/fiber": ["fiber", "web"],
  "gorm.io/gorm": ["gorm", "database"],
}

const RUST_DEPENDENCY_TAGS: Record<string, string[]> = {
  axum: ["axum", "web"],
  "actix-web": ["actix", "web"],
  rocket: ["rocket", "web"],
  tokio: ["tokio", "async"],
  serde: ["serde"],
  clap: ["cli"],
  bevy: ["bevy", "game"],
  tauri: ["tauri", "desktop"],
  leptos: ["leptos", "web"],
  yew: ["yew", "web"],
  sqlx: ["sqlx", "database"],
  diesel: ["diesel", "database"],
}

const RUBY_DEPENDENCY_TAGS: Record<string, string[]> = {
  rails: ["rails", "web"],
  sinatra: ["sinatra", "web"],
  rspec: ["rspec", "testing"],
}

const PHP_DEPENDENCY_TAGS: Record<string, string[]> = {
  "laravel/framework": ["laravel", "web"],
  "symfony/framework-bundle": ["symfony", "web"],
}

function addTagsFromHints(text: string, hints: Record<string, string[]>, tags: Set<string>): void {
  if (!text) return
  const lower = text.toLowerCase()
  for (const [dependency, mapped] of Object.entries(hints)) {
    const matched = /[^a-z0-9_-]/.test(dependency)
      ? lower.includes(dependency)
      : new RegExp(`(^|[^a-z0-9_-])${escapeRegExp(dependency)}([^a-z0-9_-]|$)`, "i").test(lower)
    if (matched) for (const tag of mapped) tags.add(tag)
  }
}

/**
 * Deterministically infer coarse project "genre" tags from marker files and
 * manifests in the project directory. Best-effort and side-effect free.
 */
export function detectProjectTags(directory: string): string[] {
  const tags = new Set<string>()
  if (!directory) return []
  const entries = listEntries(directory)
  const names = new Set(entries)
  const has = (name: string) => names.has(name)
  const endsWith = (suffix: string) => entries.some((entry) => entry.endsWith(suffix))
  const read = (name: string) => readTextFile(path.join(directory, name))

  if (has("package.json")) {
    tags.add("node")
    tags.add("javascript")
    addTagsFromHints(read("package.json"), JAVASCRIPT_DEPENDENCY_TAGS, tags)
  }
  if (has("tsconfig.json")) tags.add("typescript")
  if (has("deno.json") || has("deno.jsonc")) { tags.add("deno"); tags.add("typescript") }
  if (has("bun.lockb") || has("bun.lock") || has("bunfig.toml")) tags.add("bun")

  if (has("pyproject.toml") || has("requirements.txt") || has("setup.py") || has("setup.cfg") || has("Pipfile") || has("poetry.lock") || has("uv.lock")) {
    tags.add("python")
    addTagsFromHints(read("pyproject.toml"), PYTHON_DEPENDENCY_TAGS, tags)
    addTagsFromHints(read("requirements.txt"), PYTHON_DEPENDENCY_TAGS, tags)
  }
  if (has("go.mod")) { tags.add("go"); addTagsFromHints(read("go.mod"), GO_DEPENDENCY_TAGS, tags) }
  if (has("Cargo.toml")) { tags.add("rust"); addTagsFromHints(read("Cargo.toml"), RUST_DEPENDENCY_TAGS, tags) }
  if (has("pom.xml")) { tags.add("java"); tags.add("maven") }
  if (has("build.gradle") || has("build.gradle.kts") || has("settings.gradle") || has("settings.gradle.kts")) tags.add("gradle")
  if (has("build.gradle") || has("build.gradle.kts") || has("pom.xml")) tags.add("jvm")
  if (has("AndroidManifest.xml") || isDirectory(directory, "app/src/main")) { tags.add("android"); tags.add("mobile") }
  if (has("Gemfile")) { tags.add("ruby"); addTagsFromHints(read("Gemfile"), RUBY_DEPENDENCY_TAGS, tags) }
  if (has("composer.json")) { tags.add("php"); addTagsFromHints(read("composer.json"), PHP_DEPENDENCY_TAGS, tags) }
  if (has("pubspec.yaml")) { tags.add("dart"); tags.add("flutter"); tags.add("mobile") }
  if (has("Package.swift") || endsWith(".xcodeproj") || endsWith(".xcworkspace")) { tags.add("swift"); tags.add("apple") }
  if (has("mix.exs")) tags.add("elixir")
  if (has("build.sbt")) tags.add("scala")
  if (has("cpanfile")) tags.add("perl")
  if (endsWith(".rockspec")) tags.add("lua")
  if (has("CMakeLists.txt")) { tags.add("cmake"); tags.add("cpp") }
  if (has("Makefile") || has("makefile")) tags.add("make")
  if (has("Dockerfile") || has("docker-compose.yml") || has("docker-compose.yaml") || has("compose.yml") || has("compose.yaml")) tags.add("docker")
  if (endsWith(".tf") || isDirectory(directory, "terraform")) tags.add("terraform")
  if (isDirectory(directory, "k8s") || isDirectory(directory, "kubernetes") || isDirectory(directory, "helm") || isDirectory(directory, "charts")) tags.add("kubernetes")
  if (isDirectory(directory, ".github/workflows")) tags.add("ci")
  if (has("prisma/schema.prisma") || isDirectory(directory, "prisma")) tags.add("prisma")
  if (endsWith(".graphql") || endsWith(".gql")) tags.add("graphql")
  if (has(".eslintrc") || has(".eslintrc.js") || has(".eslintrc.cjs") || has("eslint.config.js") || has("eslint.config.mjs") || has("eslint.config.ts")) tags.add("eslint")

  if (tags.has("react-native") || tags.has("expo") || tags.has("flutter") || tags.has("android")) tags.add("mobile")
  if (tags.has("electron") || tags.has("tauri")) tags.add("desktop")

  return [...tags].sort().slice(0, 32)
}

/** Jaccard similarity between two tag sets; 0 when either side is empty. */
export function projectSimilarity(left: string[], right: string[]): number {
  const a = new Set(left.map(normalizeTag).filter(Boolean))
  const b = new Set(right.map(normalizeTag).filter(Boolean))
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const tag of a) if (b.has(tag)) shared++
  const union = new Set([...a, ...b]).size
  return union ? shared / union : 0
}

function ageInDays(iso: string): number {
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 86_400_000) : 365
}

/** Recompute whether a skill is broadly useful ("common") or project-specific. */
export function computeSkillTier(
  skill: LearnedSkill,
  options: {
    commonMinProjects: number
    commonMinUses: number
    minimumSkillVerifiedSuccesses?: number
    minimumSkillSuccessRate?: number
  },
): SkillTier {
  const projects = new Set((skill.projectIDs ?? [skill.projectID]).filter(Boolean)).size
  const attempts = skill.successes + skill.failures
  const minimumSuccesses = options.minimumSkillVerifiedSuccesses ?? options.commonMinUses
  const minimumRate = options.minimumSkillSuccessRate ?? 0.75
  const reliable = attempts > 0 && skill.successes >= minimumSuccesses && skill.successes / attempts >= minimumRate
  if (projects >= options.commonMinProjects && skill.uses >= options.commonMinUses && reliable) return "common"
  return "project"
}

/**
 * Distill a newly observed procedure into an existing library skill. The richer
 * procedure text wins, evidence and applicability metadata are unioned, and the
 * version is bumped so later iterations build on earlier learning.
 */
export function mergeLibrarySkill(
  existing: LearnedSkill,
  incoming: {
    name: string
    description: string
    content: string
    triggerTerms: string[]
    tags: string[]
    projectID: string
    evidenceMemoryIDs?: string[]
    now: string
  },
): { refined: boolean } {
  const incomingContent = incoming.content.trim()
  const existingContent = (existing.content ?? "").trim()
  let refined = false
  if (incomingContent && (incomingContent.length > existingContent.length * 1.15 || !existingContent)) {
    existing.content = incomingContent
    refined = true
  }
  if (!existing.name) existing.name = incoming.name
  if (incoming.description && incoming.description.length > (existing.description ?? "").length) {
    existing.description = incoming.description
  }
  existing.triggerTerms = [...new Set([...(existing.triggerTerms ?? []), ...incoming.triggerTerms])].slice(0, 24)
  existing.tags = [...new Set([...(existing.tags ?? []), ...incoming.tags])].slice(0, 32)
  existing.projectIDs = [...new Set([...(existing.projectIDs ?? [existing.projectID]), incoming.projectID].filter(Boolean))]
  existing.version = (existing.version ?? 1) + 1
  existing.updatedAt = incoming.now
  if (incoming.evidenceMemoryIDs?.length) {
    existing.evidenceMemoryIDs = [...new Set([...(existing.evidenceMemoryIDs ?? []), ...incoming.evidenceMemoryIDs])].slice(-20)
  }
  existing.history = [
    ...(existing.history ?? []),
    { version: existing.version, at: incoming.now, note: refined ? "refined with a more complete procedure" : "confirmed and revalidated" },
  ].slice(-20)
  return { refined }
}

/** Validate and normalize the untrusted common-folder manifest read from disk. */
export function parseLibraryIndex(value: unknown): LibraryIndex {
  const empty: LibraryIndex = { version: 1, updatedAt: new Date(0).toISOString(), skills: [] }
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty
  const record = value as Record<string, unknown>
  const rawSkills = Array.isArray(record.skills) ? record.skills : []
  const skills: LearnedSkill[] = []
  for (const raw of rawSkills.slice(0, 1_000)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const skill = raw as Record<string, unknown>
    const id = typeof skill.id === "string" ? skill.id : ""
    const name = typeof skill.name === "string" ? skill.name : ""
    const content = typeof skill.content === "string" ? skill.content : ""
    if (!isValidLibrarySkillID(id) || !name || !content) continue
    const createdAt = typeof skill.createdAt === "string" ? skill.createdAt : new Date(0).toISOString()
    const updatedAt = typeof skill.updatedAt === "string" ? skill.updatedAt : createdAt
    const projectID = typeof skill.projectID === "string" ? skill.projectID : ""
    const projectIDs = stringList(skill.projectIDs, 200)
    if (projectID && !projectIDs.includes(projectID)) projectIDs.unshift(projectID)
    skills.push({
      id,
      name,
      description: typeof skill.description === "string" ? skill.description : "",
      content,
      triggerTerms: stringList(skill.triggerTerms, 24),
      projectID,
      version: Math.max(1, Math.floor(nonNegative(skill.version, 1))),
      uses: Math.floor(nonNegative(skill.uses, 0)),
      successes: Math.floor(nonNegative(skill.successes, 0)),
      failures: Math.floor(nonNegative(skill.failures, 0)),
      createdAt,
      updatedAt,
      evidenceMemoryIDs: stringList(skill.evidenceMemoryIDs, 20),
      tags: stringList(skill.tags, 32).map(normalizeTag),
      tier: skill.tier === "common" ? "common" : "project",
      projectIDs,
      history: Array.isArray(skill.history)
        ? skill.history.slice(-20).map((entry) => {
            const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {}
            return {
              version: Math.max(1, Math.floor(nonNegative(record.version, 1))),
              at: typeof record.at === "string" ? record.at : createdAt,
              note: typeof record.note === "string" ? record.note.slice(0, 200) : "",
            }
          })
        : undefined,
    })
  }
  return {
    version: 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
    skills,
  }
}

/** Parse a SKILL.md file written by this plugin; used to rebuild a missing manifest. */
export function parseSkillMarkdown(
  markdown: string,
): { name: string; description: string; content: string; metadata: Record<string, string> } | null {
  const normalized = markdown.replace(/^\uFEFF/, "").trimStart()
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(normalized)
  if (!match) return null
  const front = match[1] ?? ""
  const content = (match[2] ?? "").trim()
  const metadata: Record<string, string> = {}
  const parseScalar = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed.startsWith('"')) return trimmed
    try {
      const parsed = JSON.parse(trimmed)
      return typeof parsed === "string" ? parsed : trimmed
    } catch {
      return trimmed
    }
  }
  for (const line of front.split(/\r?\n/)) {
    const entry = /^\s*([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line)
    if (entry?.[1]) metadata[entry[1]] = parseScalar(entry[2] ?? "")
  }
  const name = metadata.name ?? ""
  if (!name || !content) return null
  return { name, description: metadata.description ?? "", content, metadata }
}

/**
 * Select the library skills that should be available in this project: broadly
 * useful "common" skills plus project-specific skills whose applicability tags
 * match the current project.
 */
export function selectLibrarySkills(
  library: LearnedSkill[],
  currentProjectID: string,
  currentTags: string[],
  options: {
    minSimilarity: number
    maxSkills: number
    commonMinProjects: number
    commonMinUses: number
    minimumSkillVerifiedSuccesses?: number
    minimumSkillSuccessRate?: number
  },
): LibrarySkillCandidate[] {
  if (options.maxSkills <= 0) return []
  const candidates: LibrarySkillCandidate[] = []
  for (const skill of library) {
    const tags = skill.tags ?? []
    const similarity = currentTags.length && tags.length ? projectSimilarity(currentTags, tags) : 0
    const known = (skill.projectIDs ?? [skill.projectID]).includes(currentProjectID)
    const tier = skill.tier ?? computeSkillTier(skill, options)
    const attempts = skill.successes + skill.failures
    const verified =
      skill.successes >= (options.minimumSkillVerifiedSuccesses ?? options.commonMinUses) &&
      attempts > 0 &&
      skill.successes / attempts >= (options.minimumSkillSuccessRate ?? 0.75)
    // Candidate skills remain available in projects that produced or used them,
    // but cannot spread to another project until outcomes verify them.
    if (!known && !verified) continue
    const matches = known || similarity >= options.minSimilarity
    if (tier !== "common" && !matches) continue
    const recency = Math.max(0.7, Math.exp(-ageInDays(skill.updatedAt) / 365))
    const successRate = attempts > 0 ? skill.successes / attempts : 0.5
    const score =
      (tier === "common" ? 1.2 : 0) +
      (known ? 1.0 : 0) +
      similarity * 2 +
      Math.min(skill.uses, 20) * 0.02 +
      successRate * 0.3 -
      Math.min(skill.failures, 10) * 0.03 +
      recency * 0.1
    candidates.push({ skill, score, reason: tier, similarity })
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, options.maxSkills)
}
