# Codegraph Command Reference

## "I want to..." Quick Reference

| I want to... | CLI Command | MCP Tool |
|---------------|-------------|----------|
| Find where a function is defined | `codegraph where <name>` | `where` |
| See what a file does | `codegraph audit --quick <file>` | `explain` |
| Understand a function fully | `codegraph context <name> -T` | `context` |
| See what calls a function | `codegraph query <name> -T` | `query` |
| Check impact before editing | `codegraph fn-impact <name> -T` | `fn_impact` |
| Check impact of staged changes | `codegraph diff-impact --staged -T` | `diff_impact` |
| Compare branch impact vs main | `codegraph diff-impact main -T` | `diff_impact` |
| Find code by description | `codegraph search "description"` | `semantic_search` |
| Get a codebase overview | `codegraph map` | `module_map` |
| Check graph health | `codegraph stats` | (CLI only) |
| Find circular dependencies | `codegraph cycles` | `find_cycles` |
| Find hotspots | `codegraph triage --level file --sort coupling` | `hotspots` |
| See project structure | `codegraph structure --depth 2` | `structure` |
| List symbols in a file | `codegraph where --file <path>` | `where` |
| Get a full risk report | `codegraph audit <name> -T` | `audit` |
| Get ranked riskiest functions | `codegraph triage -T --limit 20` | `triage` |
| Batch query multiple targets | `codegraph batch t1 t2 t3 -T --json` | `batch_query` |
| Validate staged changes | `codegraph check --staged --no-new-cycles` | `check` |
| Compare structure between branches | `codegraph branch-compare main HEAD -T` | `branch_compare` |
| See what a file exports and who uses it | `codegraph exports <file> -T` | `file_exports` |
| See fields/properties of a class | `codegraph children <name> -T` | `symbol_children` |
| Trace data flow | `codegraph dataflow <name> -T` | `dataflow` |
| See control flow graph | `codegraph cfg <name> --format mermaid -T` | `cfg` |
| Find all call sites | `codegraph ast --kind call <name> -T` | `ast_query` |
| Find dead code | `codegraph roles --role dead -T` | `node_roles` |
| Find core symbols | `codegraph roles --role core -T` | `node_roles` |
| Per-function complexity metrics | `codegraph complexity -T` | `complexity` |
| Module boundary drift | `codegraph communities --drift -T` | `communities` |
| Files that change together | `codegraph co-change <file>` | `co_changes` |
| File dependencies | `codegraph deps <file>` | `file_deps` |
| File-level impact | `codegraph impact <file>` | `impact_analysis` |
| Shortest path between symbols | `codegraph path <from> <to> -T` | `query` |
| Export graph for visualization | `codegraph export --format mermaid` | `export_graph` |
| Interactive graph viewer | `codegraph plot` | (CLI only) |
| Build/update the graph | `codegraph build .` | (CLI only) |
| Build semantic embeddings | `codegraph embed .` | (CLI only) |
| Checkpoint graph before refactor | `codegraph snapshot save <name>` | (CLI only) |
| Restore graph after failed refactor | `codegraph snapshot restore <name>` | (CLI only) |

## Build & Watch

```bash
codegraph build [dir]             # Incremental build (default)
codegraph build --no-incremental  # Force full rebuild
codegraph watch [dir]             # Watch for changes, update incrementally
```

## Navigation

```bash
codegraph where <name>              # Symbol definition + usage sites
codegraph where --file <path>       # File inventory: symbols, imports, exports
codegraph query <name> -T           # Callers + callees chain
codegraph query <name> --depth 5    # Deep transitive trace
codegraph deps <file>               # File imports and importers
codegraph exports <file> -T         # Per-symbol export consumers
codegraph children <name> -T        # Sub-declarations (params, properties)
codegraph path <from> <to> -T       # Shortest path between two symbols
```

## Context & Understanding

```bash
codegraph context <name> -T           # Source + deps + callers (primary tool)
codegraph context <name> --depth 1    # Include callee source too
codegraph context <name> --no-source  # Metadata only (fastest)
codegraph audit --quick <target>      # Structural summary
codegraph audit <target> -T           # Full risk report
```

## Impact Analysis

```bash
codegraph fn-impact <name> -T         # Function blast radius
codegraph impact <file>               # File-level transitive impact
codegraph diff-impact --staged -T     # Staged changes impact
codegraph diff-impact main -T         # Branch vs main impact
codegraph branch-compare main HEAD -T # Structural diff between refs
```

## Search

```bash
codegraph search "handle authentication"                    # Single query
codegraph search "validate input; sanitize request" -T      # Multi-query RRF
codegraph search "auth" --mode keyword                      # BM25 keyword only
codegraph search "auth flow" --mode semantic                # Embedding only
codegraph search "parse config" --kind function --limit 10  # Filtered
```

## Code Health

```bash
codegraph complexity -T                 # Per-function metrics
codegraph complexity --above-threshold  # Only functions exceeding thresholds
codegraph roles --role dead -T          # Dead code candidates
codegraph roles --role core -T          # High fan-in core symbols
codegraph cycles                        # File-level circular deps
codegraph cycles --functions            # Function-level circular deps
codegraph communities --drift -T        # Module boundary drift
codegraph co-change <file>              # Historical co-change coupling
codegraph triage -T --limit 20          # Risk-ranked priority queue
```

## CI & Validation

```bash
codegraph check --staged                    # All manifesto rules on staged
codegraph check --staged --no-new-cycles    # Fail on new cycles
codegraph check --max-complexity 30         # Fail on complexity threshold
codegraph check --max-blast-radius 50       # Fail on blast radius
codegraph check --no-boundary-violations    # Fail on boundary violations
```

## Deep Analysis

```bash
codegraph dataflow <name> -T              # Data flow edges
codegraph dataflow <name> --impact -T     # Data-dependent blast radius
codegraph cfg <name> -T                   # Control flow graph (JSON)
codegraph cfg <name> --format mermaid -T  # CFG as Mermaid diagram
codegraph ast --kind call <name> -T       # Find call sites
codegraph ast --kind throw --file src/ -T # Find throw statements
```

## Common Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--no-tests` | `-T` | Exclude test/spec files | off (use by default) |
| `--json` | `-j` | JSON output | off |
| `--file <path>` | `-f` | Scope to a specific file | all files |
| `--kind <kind>` | `-k` | Filter by symbol kind | all kinds |
| `--depth <n>` | | Traversal depth | varies |
| `--limit <n>` | | Max results | varies |
| `--mode <mode>` | | Search mode: hybrid/semantic/keyword | hybrid |

## Symbol Kinds

`function` `method` `class` `interface` `type` `struct` `enum` `trait` `record` `module` `parameter` `property` `constant`
