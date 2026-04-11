---
name: codegraph
description: >-
  Navigate, query, and analyze the codebase using codegraph dependency graph.
  Use when searching for symbols, understanding code structure, assessing change impact,
  or before/after modifying code. Prefer codegraph over grep/find/cat for all structural queries.
---
# Codegraph Agent Workflow

This project has a codegraph dependency graph (`.codegraph/graph.db`) covering both `api/` and `web/` packages plus `libs/shared-types/`.
A codegraph MCP server is registered -- you can call its tools directly. The CLI is also available via shell.

## When to use codegraph vs grep

**Use codegraph for** (primary tool):
- Finding where a symbol is defined and used
- Understanding a function's callers, callees, and dependencies
- Assessing blast radius before/after changes
- Semantic search by intent ("handle authentication", "validate input")
- File dependency analysis (imports/importers)
- Dead code detection, complexity metrics, cycle detection

**Fall back to grep for**:
- String literals, error messages, config keys
- Non-code files (JSON, YAML, Markdown, .env)
- Regex pattern matching in file contents
- When codegraph MCP server is unavailable

## The 6-Step Workflow

### Step 1: Orient
Get a high-level view before diving in.
```bash
codegraph map --limit 20       # Most-connected modules
codegraph stats                # Graph health: nodes, edges, quality score
codegraph structure            # Directory tree with cohesion scores
```

### Step 2: Locate
Find where the relevant symbol lives.
```bash
codegraph where <name>              # Definition + usage sites
codegraph where --file <path>       # File overview: symbols, imports, exports
codegraph search "error handling"   # Semantic search by intent
```

### Step 3: Understand
Get a structural summary without reading raw source.
```bash
codegraph audit --quick <file>      # File summary: public API, internals, data flow
codegraph audit --quick <function>  # Function: signature, calls, callers, tests
```

### Step 4: Gather Context
Pull everything needed to make the change -- in one call.
```bash
codegraph context <name> -T         # Source + deps + callers (no test files)
codegraph context <name> --depth 1  # Include callee source code too
codegraph query <name> -T           # Lighter: just callers/callees chain
```

### Step 5: Assess Impact
Check what will break before making changes.
```bash
codegraph fn-impact <name> -T       # Function-level blast radius
codegraph impact <file>             # File-level transitive dependents
```

### Step 6: Verify
After edits, rebuild and check before committing.
```bash
codegraph build .                   # Incremental rebuild (sub-second)
codegraph diff-impact --staged -T   # Impact of what you're about to commit
codegraph cycles                    # Ensure no new circular dependencies
```

## Token Savings

| Task | Without codegraph | With codegraph | Savings |
|------|------------------|----------------|---------|
| Understand a function | Read 3-5 files (~10K tokens) | `context <name>` (~400 tokens) | ~96% |
| Find what a file does | Read file + imports (~4K tokens) | `audit --quick <file>` (~300 tokens) | ~92% |
| Locate a symbol | Grep + read matches (~3K tokens) | `where <name>` (~60 tokens) | ~98% |
| Assess change impact | Read callers manually (~5K tokens) | `fn-impact <name>` (~200 tokens) | ~96% |
| Pre-commit check | Manual review (~8K tokens) | `diff-impact --staged` (~300 tokens) | ~96% |

## MCP Tools Available

The codegraph MCP server exposes these tools (call directly, no shell needed):

| MCP Tool | Purpose |
|----------|---------|
| `where` | Symbol definition and usage sites |
| `context` | Full function context (source + deps + callers) |
| `fn_impact` | Function-level blast radius |
| `diff_impact` | Git diff impact analysis |
| `query` | Callers/callees chain, shortest path |
| `file_deps` | File imports and importers |
| `file_exports` | Per-symbol export consumers |
| `explain` | Structural summary (audit --quick) |
| `semantic_search` | Natural language code search |
| `impact_analysis` | File-level transitive impact |
| `find_cycles` | Circular dependency detection |
| `module_map` | Most-connected files overview |
| `node_roles` | Symbol role classification (entry/core/dead) |
| `complexity` | Per-function complexity metrics |
| `structure` | Directory tree with metrics |
| `hotspots` | Structural hotspot detection |
| `audit` | Composite risk report |
| `triage` | Risk-ranked audit queue |
| `batch_query` | Multi-target batch querying |
| `check` | CI validation predicates |
| `co_changes` | Git co-change analysis |
| `branch_compare` | Structural diff between refs |
| `dataflow` | Data flow edges and impact |
| `cfg` | Intraprocedural control flow graph |
| `ast_query` | Search stored AST nodes |
| `symbol_children` | Parameters, properties, constants |
| `export_graph` | DOT/Mermaid/JSON/GraphML export |
| `list_functions` | List/filter symbols |

## Semantic Search Tips

Use multi-query with `;` for better recall. Each sub-query attacks the problem from a different angle:

```bash
# Naming variants
codegraph search "validate input; sanitize request; check params"

# Abstraction levels
codegraph search "handle payment; charge credit card"

# Domain + technical terms
codegraph search "user permissions; role-based access; check authorization"
```

Keep sub-queries to 2-4 words each. Use `--kind function` or `--file <path>` to reduce noise.

## Key Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--no-tests` | `-T` | Exclude test files (use by default) |
| `--json` | `-j` | JSON output |
| `--file <path>` | `-f` | Scope to a file |
| `--kind <kind>` | `-k` | Filter by symbol kind |
| `--depth <n>` | | Traversal depth |

## Tips

1. **Always use `-T`** unless specifically working on tests.
2. **Prefer `context` over raw file reads.** One call replaces 3-5 file reads.
3. **Use `--file` to disambiguate** when symbols share names across api/web.
4. **Check impact before AND after.** `fn-impact` before editing; `diff-impact --staged` after.
5. **Use `audit --quick` for orientation, `context` for implementation.**
6. **Rebuild after edits.** `codegraph build .` is sub-second incremental.

## Full Command Reference

For the complete command cheat sheet with all 40+ commands, see [reference.md](reference.md).
