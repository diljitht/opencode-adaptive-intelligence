#!/usr/bin/env node
import fs from "node:fs"

const file = process.argv[2]
if (!file) {
  console.error("Usage: npm run evaluate -- <paired-results.jsonl>")
  process.exit(1)
}

const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line) }
  catch { throw new Error(`Invalid JSON on line ${index + 1}`) }
})

const variants = ["control", "plugin"]
const summarize = (variant) => {
  const selected = rows.filter((row) => row.variant === variant)
  const average = (key) => selected.length
    ? selected.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / selected.length
    : 0
  return {
    tasks: selected.length,
    completionRate: average("completed"),
    verificationRate: average("verified"),
    averageTokens: average("tokens"),
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
report.delta = {
  completionRate: report.plugin.completionRate - report.control.completionRate,
  verificationRate: report.plugin.verificationRate - report.control.verificationRate,
  averageTokens: report.plugin.averageTokens - report.control.averageTokens,
  incorrectRecalls: report.plugin.incorrectRecalls - report.control.incorrectRecalls,
  regressions: report.plugin.regressions - report.control.regressions,
}

console.log(JSON.stringify(report, null, 2))
