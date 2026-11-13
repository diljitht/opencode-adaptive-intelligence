#!/usr/bin/env node
import fs from "node:fs"

const file = process.argv[2]
if (!file) {
  console.error("Usage: npm run evaluate -- <paired-results.jsonl>")
  process.exit(1)
}

const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
  try {
    const row = JSON.parse(line)
    if (!row || typeof row !== "object" || typeof row.task !== "string" || !["control", "plugin"].includes(row.variant)) {
      throw new Error("expected a task string and variant control|plugin")
    }
    for (const key of ["completed", "verified", "tokens", "learningTokens", "incorrectRecalls", "regression"]) {
      if (row[key] !== undefined && !Number.isFinite(Number(row[key]))) throw new Error(`${key} must be numeric`)
    }
    return row
  }
  catch { throw new Error(`Invalid JSON on line ${index + 1}`) }
})

const variants = ["control", "plugin"]
const summarize = (variant) => {
  const selected = rows.filter((row) => row.variant === variant)
  const values = (key) => selected.map((row) => Number(row[key] ?? 0)).sort((a, b) => a - b)
  const average = (key) => selected.length
    ? selected.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / selected.length
    : 0
  const percentile = (key, fraction) => {
    const sorted = values(key)
    if (!sorted.length) return 0
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
  }
  return {
    tasks: selected.length,
    completionRate: average("completed"),
    verificationRate: average("verified"),
    averageTokens: average("tokens"),
    medianTokens: percentile("tokens", 0.5),
    p95Tokens: percentile("tokens", 0.95),
    averageLearningTokens: average("learningTokens"),
    incorrectRecalls: selected.reduce((sum, row) => sum + Number(row.incorrectRecalls ?? 0), 0),
    regressions: selected.reduce((sum, row) => sum + Number(row.regression ?? 0), 0),
  }
}

const report = Object.fromEntries(variants.map((variant) => [variant, summarize(variant)]))
const taskVariants = new Map()
for (const row of rows) {
  if (!row.task || !variants.includes(row.variant)) continue
  const pair = taskVariants.get(row.task) ?? {}
  pair[row.variant] = row
  taskVariants.set(row.task, pair)
}
const paired = [...taskVariants.values()].filter((pair) => pair.control && pair.plugin)
report.pairedTasks = paired.length
const pairedAverageDelta = (key) => paired.length
  ? paired.reduce((sum, pair) => sum + Number(pair.plugin[key] ?? 0) - Number(pair.control[key] ?? 0), 0) / paired.length
  : 0
report.delta = {
  completionRate: pairedAverageDelta("completed"),
  verificationRate: pairedAverageDelta("verified"),
  averageTokens: pairedAverageDelta("tokens"),
  averageLearningTokens: pairedAverageDelta("learningTokens"),
  incorrectRecalls: pairedAverageDelta("incorrectRecalls"),
  regressions: pairedAverageDelta("regression"),
}

console.log(JSON.stringify(report, null, 2))
