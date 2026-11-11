import test from "node:test"
import assert from "node:assert/strict"
import {
  addOrMergeEdge,
  addOrMergeMemory,
  assessTask,
  compactOldToolOutputs,
  decisionGuidance,
  emptyState,
  hybridSearchMemories,
  inferMemoryEdges,
  parseGeneratedJSON,
  pseudonymizeSensitive,
  pseudonymizeValue,
  redactSecrets,
  sanitizeMessageText,
  searchMemories,
  tokenize,
  type Memory,
} from "../src/core.js"

function memory(id: string, text: string): Memory {
  return {
    id, text, kind: "fact", keywords: tokenize(text), projectID: "p1", confidence: 0.8, uses: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}

test("decision recall ranks overlapping project memory", () => {
  const results = searchMemories([
    memory("a", "The API uses cookie authentication"),
    memory("b", "The UI uses a purple theme"),
  ], "cookie auth API", "p1", 2)
  assert.equal(results[0]?.memory.id, "a")
})

test("task preflight avoids delegation for a small reversible task", () => {
  const assessment = assessTask({
    prompt: "Rename the button label from Save to Apply.", estimatedInputTokens: 2_000,
    contextWindow: 128_000, maxSubagents: 4, safetyReserve: 0.2,
  })
  assert.equal(assessment.strategy, "direct")
  assert.equal(assessment.recommendedSubagents, 0)
})

test("task preflight recommends bounded parallelism for independent complex work", () => {
  const assessment = assessTask({
    prompt: "Implement the backend API, migrate the database, build the frontend, add security review, tests, and documentation.",
    estimatedInputTokens: 10_000, contextWindow: 128_000, maxSubagents: 4, safetyReserve: 0.2,
  })
  assert.notEqual(assessment.strategy, "direct")
  assert.ok(assessment.recommendedSubagents >= 2)
  assert.ok(assessment.recommendedSubagents <= 4)
  assert.match(decisionGuidance(assessment, 0.2), /Ask only when authorization is missing/)
})

test("tight context pressure caps delegation to one", () => {
  const assessment = assessTask({
    prompt: "Research and implement backend, frontend, database, tests, docs, security, and performance improvements.",
    estimatedInputTokens: 90_000, contextWindow: 100_000, maxSubagents: 6, safetyReserve: 0.2,
  })
  assert.ok(assessment.contextPressure >= 0.8)
  assert.ok(assessment.recommendedSubagents <= 1)
})

test("near duplicate memories merge", () => {
  const state = emptyState()
  addOrMergeMemory(state, memory("a", "Use pnpm for package installation"), 20)
  addOrMergeMemory(state, memory("b", "Use pnpm for package installs"), 20)
  assert.equal(state.memories.length, 1)
})

test("hybrid recall expands a lexical seed through a solved-by edge", () => {
  const state = emptyState()
  const failure = { ...memory("failure", "Background request returned HTTP 401"), kind: "failure" as const }
  const solution = { ...memory("solution", "Reuse the authenticated session cookie"), kind: "solution" as const }
  state.memories.push(failure, solution)
  const now = new Date().toISOString()
  addOrMergeEdge(state, {
    id: "edge-1", from: failure.id, to: solution.id, relation: "solved-by", confidence: 0.95,
    confirmations: 3, contradictions: 0, active: true, projectID: "p1", createdAt: now, updatedAt: now,
  }, 20)

  const results = hybridSearchMemories(state, "background HTTP 401", "p1", 3, {
    minimumScore: 0.1, depth: 1, expansion: 4, minimumEdgeConfidence: 0.4,
  })
  const expanded = results.find((result) => result.memory.id === "solution")
  assert.equal(expanded?.source, "graph")
  assert.equal(expanded?.path[0]?.relation, "solved-by")
})

test("superseded memories remain as history but are excluded from recall", () => {
  const state = emptyState()
  const oldDecision = { ...memory("old", "Use npm for dependency installation"), kind: "decision" as const }
  const newDecision = { ...memory("new", "Use pnpm for dependency installation"), kind: "decision" as const }
  state.memories.push(oldDecision, newDecision)
  const now = new Date().toISOString()
  addOrMergeEdge(state, {
    id: "edge-super", from: newDecision.id, to: oldDecision.id, relation: "supersedes", confidence: 0.9,
    confirmations: 2, contradictions: 0, active: true, projectID: "p1", createdAt: now, updatedAt: now,
  }, 20)

  assert.equal(oldDecision.supersededBy, newDecision.id)
  const results = hybridSearchMemories(state, "npm dependency installation", "p1", 5, {
    minimumScore: 0, depth: 2, expansion: 5, minimumEdgeConfidence: 0.4,
  })
  assert.equal(results.some((result) => result.memory.id === oldDecision.id), false)
})

test("one unconfirmed supersedes edge cannot hide prior evidence", () => {
  const state = emptyState()
  const oldDecision = { ...memory("old", "Use npm for builds"), kind: "decision" as const }
  const newDecision = { ...memory("new", "Use pnpm for builds"), kind: "decision" as const }
  state.memories.push(oldDecision, newDecision)
  const now = new Date().toISOString()
  addOrMergeEdge(state, {
    id: "edge-unconfirmed", from: newDecision.id, to: oldDecision.id, relation: "supersedes", confidence: 0.95,
    confirmations: 1, contradictions: 0, active: true, projectID: "p1", createdAt: now, updatedAt: now,
  }, 20)
  assert.equal(oldDecision.validUntil, undefined)
})

test("deterministic inference links related failures and solutions", () => {
  const state = emptyState()
  const failure = { ...memory("f", "Cookie authentication fails on background request"), kind: "failure" as const }
  const solution = { ...memory("s", "Reuse cookie authentication for background request"), kind: "solution" as const }
  state.memories.push(failure, solution)
  const count = inferMemoryEdges(state, [failure.id, solution.id], "p1", "session-1", 20)
  assert.ok(count > 0)
  assert.ok(state.edges.some((edge) => edge.relation === "solved-by" && edge.from === failure.id && edge.to === solution.id))
})

test("old tool outputs are shortened but recent output is untouched", () => {
  const old = "x".repeat(10_000)
  const recent = "y".repeat(10_000)
  const messages = [
    { content: [{ type: "tool", state: { output: old } }] },
    { content: [{ type: "tool", state: { output: recent } }] },
  ]
  const removed = compactOldToolOutputs(messages, 1, 2_000)
  assert.ok(removed > 0)
  assert.ok((messages[0]!.content[0]!.state.output as string).length <= 2_000)
  assert.equal(messages[1]!.content[0]!.state.output, recent)
})

test("generated JSON fences parse and secrets redact", () => {
  assert.equal(parseGeneratedJSON("```json\n{\"memories\":[]}\n```")?.memories instanceof Array, true)
  assert.doesNotMatch(redactSecrets("api_key=supersecretvalue"), /supersecretvalue/)
})

test("sensitive data is categorized and replaced with fake values", () => {
  const source = "email alice@company.com password=hunter2-secret card 4242 4242 4242 4242"
  const scan = pseudonymizeSensitive(source)
  assert.ok(scan.categories.includes("email"))
  assert.ok(scan.categories.includes("password"))
  assert.ok(scan.categories.includes("payment-card"))
  assert.doesNotMatch(scan.text, /alice@company\.com|hunter2-secret|4242 4242/)
  assert.match(scan.text, /example\.invalid|FAKE_/)
})

test("nested tool output is pseudonymized for remote model requests", () => {
  const message = { content: [{ type: "tool", state: { output: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz" } }] }
  const scan = sanitizeMessageText(message)
  assert.ok(scan.replacements > 0)
  assert.doesNotMatch(message.content[0]!.state.output, /abcdefghijklmnopqrstuvwxyz/)
})

test("environment references are not mistaken for secret values", () => {
  const source = "api_key=env://OPENAI_API_KEY password=process.env.DB_PASSWORD"
  assert.equal(pseudonymizeSensitive(source).text, source)
})

test("outbound tool payloads are deeply pseudonymized without mutating input", () => {
  const input = { url: "https://api.example.com", headers: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz" } }
  const scan = pseudonymizeValue(input)
  assert.ok(scan.replacements > 0)
  assert.match(input.headers.authorization, /abcdefghijklmnopqrstuvwxyz/)
  assert.doesNotMatch(JSON.stringify(scan.value), /abcdefghijklmnopqrstuvwxyz/)
})
