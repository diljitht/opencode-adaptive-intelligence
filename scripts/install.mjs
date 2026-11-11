#!/usr/bin/env node
/**
 * Install OpenCode Adaptive Intelligence into a standard OpenCode plugins
 * directory, where OpenCode discovers it automatically.
 *
 *   npm run setup                 # global:  ~/.config/opencode/plugins/<id>
 *   npm run setup -- --project    # project: ./.opencode/plugins/<id>
 *   npm run setup -- --copy       # copy files instead of symlinking
 *   npm run setup -- --dir <path> # explicit destination directory
 *   npm run uninstall             # remove the installed plugin directory
 *
 * The default install symlinks this clone into the plugins directory so edits
 * and `git pull` are picked up without reinstalling. Pass `--copy` for a
 * self-contained install that does not depend on keeping the clone around.
 */
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

const copyMode = has("--copy")
const removeMode = has("--remove")
const projectMode = has("--project")
const explicitDir = value("--dir")

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

// Remove a previous install without following a symlink into the clone.
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

if (!fs.existsSync(path.join(source, "src", "index.ts"))) {
  console.error("Run this script from the opencode-adaptive-intelligence repository.")
  process.exit(1)
}
if (!fs.existsSync(path.join(source, "node_modules"))) {
  console.warn("Warning: node_modules is missing. Run `npm install` first so the plugin's dependencies resolve.")
}

fs.mkdirSync(path.dirname(target), { recursive: true })
clearExisting(target)

if (copyMode) {
  const entries = ["src", "index.ts", "package.json", "README.md", "RESEARCH.md", "opencode.example.jsonc", "LICENSE"]
  fs.mkdirSync(target, { recursive: true })
  for (const entry of entries) {
    const from = path.join(source, entry)
    if (fs.existsSync(from)) fs.cpSync(from, path.join(target, entry), { recursive: true })
  }
  // Reuse the clone's installed dependencies instead of downloading them again.
  const modules = path.join(source, "node_modules")
  if (fs.existsSync(modules)) {
    try { fs.symlinkSync(modules, path.join(target, "node_modules"), "dir") } catch { /* keep going */ }
  }
  console.log(`Copied plugin to ${target}`)
} else {
  fs.symlinkSync(source, target, "dir")
  console.log(`Linked ${target} -> ${source}`)
}

console.log("")
console.log("OpenCode discovers plugins in this directory automatically.")
console.log("Restart OpenCode, or run /reload, if it is already running.")
console.log("Optional settings can be added to opencode.json(c) as a plugins entry")
console.log("with a `package` and `options` (see opencode.example.jsonc).")
