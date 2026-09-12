# CLI reference

The package publishes the `evidence` executable. A bare invocation is the same as `evidence check`.

```text
evidence [check] [options]
evidence list [options]
evidence inspect <target> [options]
evidence graph [options]
evidence languages [options]
evidence init [options]
evidence --help
evidence --version
```

Run it through the project's installed dependency:

```bash
pnpm exec evidence check
```

## Commands

| Command | Loads config | Purpose | Default format |
| --- | --- | --- | --- |
| `check` | Yes | Evaluate every enabled claim and reference. This is the default command. | `text` |
| `list` | Yes | List selected units and addressable structural ancestors across configured scopes. | `text` |
| `inspect <target>` | Yes | Resolve one target in every applicable scope and explain its graph state. | `text` |
| `graph` | Yes | Export independent boundaries, nodes, acknowledgement edges, reviews, and diagnostics. | `json` |
| `languages` | No | Report certified programming adapters and their registry capabilities. | `text` |
| `init` | No | Create a typed starter config without overwriting an existing file. | Text status |
| `--help`, `-h` | No | Print command syntax. A command may be named before the sole help flag. | Text |
| `--version`, `-v` | No | Print the package version. The flag cannot be combined with a command or option. | Text |

`check`, `list`, `inspect`, and `graph` all evaluate the complete enabled Evidence graph first. Filters and visual formats do not change the coverage denominator.

## Options

| Option | Allowed commands | Default | Behavior and failures |
| --- | --- | --- | --- |
| `-c, --config <path>` | check, list, inspect, graph, init | `evidence.config.ts` | Select the config path. It resolves from effective `--cwd`. |
| `--cwd <path>` | check, list, inspect, graph, languages, init | `.` | Resolve CLI paths from another directory. Population roots still anchor at the resolved config file. |
| `--format <value>` | check, list, inspect, graph, languages | Command default | Check/list/inspect/languages accept `text` or `json`; graph accepts `json`, `mermaid`, or `dot`. |
| `-o, --output <path>` | check, list, inspect, graph, languages | stdout | Write the complete rendered result to a path resolved from effective `--cwd`. Parent directories are not created. |
| `--language <type>` | list | All | Keep rows from one shipped artifact adapter. Despite the option name, `markdown`, `prisma`, and `swagger` are also valid types. |
| `--kind <symbol>` | list | All | Keep rows with one shared symbol kind: programming, Markdown, Prisma, or operation selectors. |
| `-w, --watch` | check | Off | Publish an initial check and recheck after active dependencies change. `-w` is an alias. |

Every value option must occur at most once and must have a nonempty following token. Unknown flags, unsupported formats, repeated options, a missing inspect target, extra positional arguments, and options used on the wrong command fail with exit code 2 and a repair message.

## Check

```bash
pnpm exec evidence
pnpm exec evidence check --config config/evidence.config.ts
pnpm exec evidence check --format json --output reports/evidence.json
```

Text and JSON contain the same findings and counts. JSON has `schemaVersion: 1`, the resolved config file, original claim and reference indexes, status, success, exit code, counts, claims, obligations, and diagnostics.

A normal report goes to stdout, including a complete report with Evidence violations. An operational text failure goes to stderr. An operational JSON failure stays on stdout as a versioned JSON object so a machine consumer can parse it. When `--output` succeeds, stdout and stderr remain empty and the command preserves the report's exit code.

## List

```bash
pnpm exec evidence list
pnpm exec evidence list --language typescript --kind function --format json
```

Each row includes its configured scope, semantic unit ID, canonical target, public aliases, symbol kind, name, selection state, and declaration locations. Unselected structural ancestors appear when they remain valid aggregate targets. Withdrawn units stay out of the list and remain discoverable through `inspect`. `--language` and `--kind` filter the rendered inventory after the full graph check and do not change obligations.

## Inspect

```bash
pnpm exec evidence inspect 'src/calculator.ts#Calculator.prototype.add'
pnpm exec evidence inspect 'POST:/sales' --format json
```

The target is the command's only positional argument. Programming and Markdown paths entered at the command line resolve from `--cwd`; Prisma and Swagger targets have no file path. The report includes an inspection for every applicable configured scope and preserves `resolved`, `ambiguous`, `hidden`, `malformed`, `missing-file`, `missing-member`, `out-of-population`, `unsupported-host`, and `incomplete` outcomes.

A resolved unit includes aliases, children, declaration hosts, its current fingerprint, incoming acknowledgements and exclusions, and matching reviews. An unresolved inspection exits 1 after complete analysis. An incomplete graph or target analysis exits 2.

## Graph

```bash
pnpm exec evidence graph --format json
pnpm exec evidence graph --format mermaid --output reports/evidence.mmd
pnpm exec evidence graph --format dot --output reports/evidence.dot
```

JSON is the authoritative lossless graph. It preserves each claim/reference boundary, unit and host nodes, acknowledgement edges, reviews as separate relations, and diagnostics. Mermaid and DOT are visual projections. Generated node IDs and escaped labels prevent source-controlled paths, quotes, newlines, or graph operators from changing diagram structure.

## Languages

```bash
pnpm exec evidence languages
pnpm exec evidence languages --format json
```

This command reads the shipped registry without loading a config or grammar WASM. It reports one row per certified programming language, including grammar file patterns, supported symbols, public-surface rules, documentation carriers, address rules, and unsupported capabilities. Grammar-only candidates are omitted. See [certified languages](languages.md).

## Init

```bash
pnpm exec evidence init
pnpm exec evidence init --config config/evidence.config.ts --cwd packages/application
```

`init` creates one typed starter config and no other file. It uses exclusive creation and fails rather than overwriting an existing config. `--format` and `--output` are not accepted for this command.

## Watch

```bash
pnpm exec evidence check --watch
pnpm exec evidence check -w --format json --output reports/evidence.ndjson
```

Watch mode publishes an initial cycle, polls active filesystem dependencies every 250 milliseconds, waits for a 100-millisecond quiet period, and serializes fresh complete evaluations. If dependencies change during evaluation or a new dependency appears, the superseded result is discarded and recomputed before publication.

Text output emits a complete block per cycle. JSON emits NDJSON: each line is one compact `schemaVersion: 1` cycle object containing its sequential cycle number and either a check report or an operational failure. `--output` truncates its destination once when watch starts and appends each framed cycle.

Cycle exit codes are data while the watcher remains active. Missing files and roots stay watched so creation can repair them. A failed config retains the previous active dependency set plus dependencies found in the failed config scan, but it never reuses the old config value. Locally triggered cycles refetch remote Swagger references; remote URLs are not polled independently. Ctrl+C closes resources and exits 0. An output or watcher failure exits 2.

The buffered `EvidenceCommand.run()` API rejects watch mode because an infinite stream cannot fit its buffered result. Embedders use `EvidenceWatcher.watch(callback)`, await asynchronous publication, and call `close()` to stop.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Analysis is complete and has no error-severity findings. Warning-only checks also exit 0. Help, version, languages, successful init, and Ctrl+C watch shutdown exit 0. |
| 1 | Analysis is complete but has Evidence errors, or an inspection cannot resolve a target completely. |
| 2 | CLI/configuration is invalid, a required source or parser analysis is incomplete, or command output fails. |

Do not convert exit 1 or 2 to success in CI. A report with status `incomplete` means Evidence cannot establish the denominator and must not be accepted as coverage.
