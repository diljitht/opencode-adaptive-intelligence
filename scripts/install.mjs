#!/usr/bin/env node
/**
 * Install OpenCode Adaptive Intelligence as a standalone package in a standard
 * OpenCode plugins directory, where OpenCode discovers it automatically.
 *
 *   npm run setup                 # global:  ~/.config/opencode/plugins/<id>
 *   npm run setup -- --project    # project: ./.opencode/plugins/<id>
 *   npm run setup -- --dir <path> # explicit destination directory
 *   npm run uninstall             # remove the installed plugin directory
 *
 * The installer copies the plugin and installs its production dependencies in
 * the destination. The cloned repository can be moved or deleted afterward.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PLUGIN_ID = "opencode-adaptive-intelligence"
const here = path.dirname(fileURLToPath(import.meta.url))
const source = path.resolve(here, "..")
const args = process.argv.slice(2)

const has = (name) => args.includes(name)
const value = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const removeMode = has("--remove")
const projectMode = has("--project")
const explicitDir = value("--dir")

if (has("--dir") && !explicitDir) {
  console.error("--dir requires a destination path.")
  process.exit(1)
}

let target
if (explicitDir) {
  target = path.resolve(explicitDir)
} else if (projectMode) {
  target = path.resolve(process.cwd(), ".opencode", "plugins", PLUGIN_ID)
} else {
  const configRoot = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, "opencode")
    : path.join(os.homedir(), ".config", "opencode")
  target = path.join(configRoot, "plugins", PLUGIN_ID)
}

// Never allow an explicit destination to delete the clone or one of its
// parents when replacing an existing installation.
const sourceFromTarget = path.relative(target, source)
if (target === source || (sourceFromTarget && !sourceFromTarget.startsWith("..") && !path.isAbsolute(sourceFromTarget))) {
  console.error("The install destination cannot be the repository or one of its parent directories.")
  process.exit(1)
}

function clearExisting(destination) {
  try {
    const stat = fs.lstatSync(destination)
    if (stat.isDirectory() && !stat.isSymbolicLink()) fs.rmSync(destination, { recursive: true, force: true })
    else fs.unlinkSync(destination)
  } catch { /* nothing installed yet */ }
}

if (removeMode) {
  clearExisting(target)
  console.log(`Removed ${target}`)
  process.exit(0)
}

if (!fs.existsSync(path.join(source, "src", "index.ts")) || !fs.existsSync(path.join(source, "package-lock.json"))) {
  console.error("Run this script from the opencode-adaptive-intelligence repository.")
  process.exit(1)
}

const parent = path.dirname(target)
const staging = path.join(parent, `.${PLUGIN_ID}.install-${process.pid}`)
const entries = [
  "src",
  "scripts",
  "index.ts",
  "package.json",
  "package-lock.json",
  "README.md",
  "RESEARCH.md",
  "opencode.example.jsonc",
  "LICENSE",
]

fs.mkdirSync(parent, { recursive: true })
clearExisting(staging)

try {
  fs.mkdirSync(staging, { recursive: true })
  for (const entry of entries) {
    const from = path.join(source, entry)
    if (fs.existsSync(from)) fs.cpSync(from, path.join(staging, entry), { recursive: true })
  }

  console.log("Installing production dependencies...")
  const npm = process.platform === "win32" ? "npm.cmd" : "npm"
  const installed = spawnSync(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: staging,
    stdio: "inherit",
  })
  if (installed.error) throw installed.error
  if (installed.status !== 0) throw new Error(`npm ci exited with status ${installed.status ?? "unknown"}`)

  clearExisting(target)
  fs.renameSync(staging, target)
} catch (error) {
  clearExisting(staging)
  console.error(`Installation failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

console.log(`Installed standalone plugin at ${target}`)
console.log("")
console.log("OpenCode discovers plugins in this directory automatically.")
console.log("Restart OpenCode, or run /reload, if it is already running.")
console.log("The cloned repository is no longer required for the installed plugin.")
console.log("Run `npm run setup` again after pulling updates.")
console.log("Optional settings can be added to opencode.json(c) as a plugins entry")
console.log("with a `package` and `options` (see opencode.example.jsonc).")
