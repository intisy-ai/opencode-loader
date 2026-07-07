# Graph Report - opencode-loader  (2026-07-07)

## Corpus Check
- 63 files · ~50,664 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 1213 edges · 32 communities (30 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `66e1c25e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_input.ts|input.ts]]
- [[_COMMUNITY_plugins.ts|plugins.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_cli.ts|cli.ts]]
- [[_COMMUNITY_Migration recipe (Tasks 6–14)|Migration recipe (Tasks 6–14)]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_opencode-loader|opencode-loader]]
- [[_COMMUNITY_Central README Generator — Design Spec|Central README Generator — Design Spec]]
- [[_COMMUNITY_Loader delegates git plugins to the updater|Loader delegates git plugins to the updater]]
- [[_COMMUNITY_Marketplace Multi-Select + Batch Install — Design Spec|Marketplace Multi-Select + Batch Install — Design Spec]]
- [[_COMMUNITY_core|core]]
- [[_COMMUNITY_Global Constraints|Global Constraints]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_tui-extension.ts|tui-extension.ts]]
- [[_COMMUNITY_File Structure|File Structure]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_testing.ts|testing.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_plugin.ts|plugin.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_Core Launcher - Specifications & Test Requirements|Core Launcher - Specifications & Test Requirements]]
- [[_COMMUNITY_account-menu.ts|account-menu.ts]]
- [[_COMMUNITY_selection.test.mjs|selection.test.mjs]]
- [[_COMMUNITY_OpenCode Launcher - Specifications & Test Requirements|OpenCode Launcher - Specifications & Test Requirements]]
- [[_COMMUNITY_build.mjs|build.mjs]]

## God Nodes (most connected - your core abstractions)
1. `handlePluginKey()` - 28 edges
2. `render()` - 22 edges
3. `flash()` - 19 edges
4. `buildPlugins()` - 19 edges
5. `loadPlugins()` - 16 edges
6. `trunc()` - 15 edges
7. `onData()` - 15 edges
8. `getUpdater()` - 15 edges
9. `compilerOptions` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `deployCommands()` --indirect_call--> `configDir()`  [INFERRED]
  core/src/command.ts → src/tui-extension.ts
- `createAccountMenu()` --indirect_call--> `handleKey()`  [INFERRED]
  core-loader/src/account-menu.ts → core-loader/src/input.ts
- `createAccountMenu()` --indirect_call--> `render()`  [INFERRED]
  core-loader/src/account-menu.ts → core-loader/src/views/render.ts
- `buildSettings()` --calls--> `loadGlobalSettings()`  [EXTRACTED]
  core-loader/src/views/settings.ts → core-loader/src/config.ts
- `buildPlugins()` --indirect_call--> `pad()`  [INFERRED]
  core-loader/src/views/plugins.ts → core-loader/src/format.ts

## Import Cycles
- 3-file cycle: `core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/mcp.ts -> core-loader/src/views/common.ts`
- 3-file cycle: `core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/plugins.ts -> core-loader/src/views/common.ts`
- 3-file cycle: `core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/projects.ts -> core-loader/src/views/common.ts`
- 3-file cycle: `core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/settings.ts -> core-loader/src/views/common.ts`
- 4-file cycle: `core-loader/src/projects.ts -> core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/projects.ts -> core-loader/src/projects.ts`
- 4-file cycle: `core-loader/src/marketplace.ts -> core-loader/src/views/common.ts -> core-loader/src/views/render.ts -> core-loader/src/views/plugins.ts -> core-loader/src/marketplace.ts`

## Communities (32 total, 2 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.07
Nodes (58): bundlePath(), CommandDef, configCommand(), deployCommands(), render(), CACHE, coerce(), configPath() (+50 more)

### Community 1 - "input.ts"
Cohesion: 0.07
Nodes (97): autoUpdateCheck(), catalogCacheHours(), coerceGlobal(), defaultTab(), loadConfig(), loaderName(), loadGlobalSettings(), loadLoaderConfig() (+89 more)

### Community 3 - "plugins.ts"
Cohesion: 0.20
Nodes (30): HOME, pad(), rule(), stringWidth(), timeAgo(), trunc(), getMcpActions(), hideCur() (+22 more)

### Community 4 - "package.json"
Cohesion: 0.08
Nodes (25): author, description, devDependencies, esbuild, plugin-updater, @types/node, typescript, vitest (+17 more)

### Community 5 - "package.json"
Cohesion: 0.08
Nodes (24): author, description, devDependencies, esbuild, @types/node, typescript, vitest, engines (+16 more)

### Community 6 - "cli.ts"
Cohesion: 0.12
Nodes (31): ACCOUNTS_JSON, accountsByProvider(), deployedHandlers(), doctor(), hasNpx(), LOADER_CONFIG, loadPluginEntries(), main() (+23 more)

### Community 7 - "Migration recipe (Tasks 6–14)"
Cohesion: 0.10
Nodes (20): Central README Generator Implementation Plan, File Structure, Global Constraints, Migration recipe (Tasks 6–14), Self-Review, Task 10: Migrate `claude-code-auth`, Task 11: Migrate `stub-auth`, Task 12: Migrate `metric-dashboard` (+12 more)

### Community 8 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, isolatedModules, lib, module, moduleResolution, outDir (+9 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, isolatedModules, lib, module, moduleResolution, outDir (+8 more)

### Community 10 - "opencode-loader"
Cohesion: 0.12
Nodes (16): Commands, Configuration, Configuration (extra), Dependencies, Installation, Keyboard shortcuts, License, Logging (+8 more)

### Community 11 - "Central README Generator — Design Spec"
Cohesion: 0.13
Nodes (14): 1. `core/src/readme.ts` — authoring API + generator, 2. Section-renderer pipeline (the extensibility core), 3. CLI action — `readme` / `readme --check`, 4. Build + CI integration, Architecture, Central README Generator — Design Spec, Components, Data flow (+6 more)

### Community 12 - "Loader delegates git plugins to the updater"
Cohesion: 0.13
Nodes (14): A. Reliable detection (`updater.ts`), B. Loader delegates all git-plugin operations (`plugins.ts`, `marketplace.ts`, `input.ts`), C. Gate + phantom removal + app-aware install (`views/plugins.ts`, `tui.ts`), D. Marketplace dual install + updater priority (`marketplace.ts`, `views`, `input.ts`), Design, E. npm plugin management parity (`plugins.ts` `getPluginActions`, `input.ts`), Error handling / edge cases, Files touched (+6 more)

### Community 13 - "Marketplace Multi-Select + Batch Install — Design Spec"
Cohesion: 0.14
Nodes (13): 1. State — `src/state.ts`, 2. Selection resolution — `src/marketplace.ts`, 3. Input — `src/input.ts` (marketplace browse mode, ~line 145), 4. Render — `src/views/plugins.ts` (marketplace loop, ~line 238-258), Components, Data flow, Error handling, Goal (+5 more)

### Community 14 - "core"
Cohesion: 0.18
Nodes (10): 100% configurable via commands, API, Commands (work in both opencode and Claude Code), Configuration, core, Installation (for a plugin author), License, Logging (+2 more)

### Community 15 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Global Constraints, Loader Delegates Git Plugins to the Updater — Implementation Plan, Self-Review, Task 1: Path-only updater detection (kill the Bun auto-install false positive), Task 2: Remove the phantom engine row + collapse the duplicated gate, Task 3: App-aware "install updater" action, Task 4: Marketplace dual install with git preferred, Task 5: npm plugin management parity (add Configure) (+1 more)

### Community 16 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, declaration, module, moduleResolution, outDir, skipLibCheck, strict, target (+1 more)

### Community 17 - "tui-extension.ts"
Cohesion: 0.47
Nodes (9): configDir(), handleKey(), modelCount(), modelsCache(), opencodeConfigPath(), providers(), readJSON(), render() (+1 more)

### Community 18 - "File Structure"
Cohesion: 0.25
Nodes (7): File Structure, Global Constraints, Marketplace Multi-Select + Batch Install Implementation Plan, Self-Review, Task 1: Pure selection module + node assertion, Task 2: Wire selection into state, input, and render, Task 3: Propagate to both loaders + patch release

### Community 19 - "devDependencies"
Cohesion: 0.25
Nodes (7): devDependencies, @types/bun, @types/node, typescript, private, scripts, build

### Community 21 - "testing.ts"
Cohesion: 0.43
Nodes (6): commandDirs(), IsolatedHomes, PluginContractSpec, runNode(), runPluginContract(), withIsolatedHomes()

### Community 22 - "package.json"
Cohesion: 0.25
Nodes (7): dependencies, left-pad, description, license, name, repository, url

### Community 23 - "plugin.ts"
Cohesion: 0.39
Nodes (5): commands, activate(), cleanup(), installOcWrapper(), writeLog()

### Community 24 - "package.json"
Cohesion: 0.33
Nodes (5): description, license, name, repository, url

### Community 25 - "Core Launcher - Specifications & Test Requirements"
Cohesion: 0.40
Nodes (4): Architectural Notes, Core Launcher - Specifications & Test Requirements, Goal, Requirements

### Community 27 - "selection.test.mjs"
Cohesion: 0.50
Nodes (3): catalog, out, selected

### Community 28 - "OpenCode Launcher - Specifications & Test Requirements"
Cohesion: 0.50
Nodes (3): Goal, OpenCode Launcher - Specifications & Test Requirements, Requirements

## Knowledge Gaps
- **201 isolated node(s):** `banner`, `private`, `build`, `@types/bun`, `@types/node` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `REPOS_DIR` connect `input.ts` to `plugins.ts`, `cli.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `PLUGINS_DIR` connect `cli.ts` to `input.ts`, `plugins.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `render()` connect `plugins.ts` to `input.ts`, `account-menu.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `buildPlugins()` (e.g. with `pad()` and `trunc()`) actually correct?**
  _`buildPlugins()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `banner`, `private`, `build` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07108081791626096 - nodes in this community are weakly interconnected._
- **Should `input.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06912361135602187 - nodes in this community are weakly interconnected._