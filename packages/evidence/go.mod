// This go.mod is for LOCAL Go tooling only (gopls, `go test ./native`).
//
// ttsc does NOT use it: at build time ttsc copies the ./native package into
// @ttsc/lint's own Go module as a sub-package (contrib/evidence) and supplies
// every dependency from the host module's graph. A contributor therefore ships
// Go SOURCE, never a module — ttsc rejects a go.mod that sits inside the
// `source` directory itself, which is why this file lives one level above
// ./native and is excluded from what ttsc copies.
//
// The replace directives point at a sibling checkout of samchon/ttsc
// (../../../../samchon/ttsc relative to this package). Adjust them to your
// layout, or delete this file — the ttsc build is unaffected either way.
module github.com/samchon/evidence-graph/packages/evidence

go 1.26

require (
	github.com/microsoft/typescript-go/shim/ast v0.0.0
	github.com/samchon/ttsc/packages/lint v0.0.0
)

require (
	github.com/go-json-experiment/json v0.0.0-20260214004413-d219187c3433 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/microsoft/typescript-go v0.0.0-20260429010842-56ab4af42157 // indirect
	github.com/microsoft/typescript-go/shim/checker v0.0.0 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
)

replace (
	github.com/microsoft/typescript-go/shim/ast => ../../../../samchon/ttsc/packages/ttsc/shim/ast
	github.com/microsoft/typescript-go/shim/bundled => ../../../../samchon/ttsc/packages/ttsc/shim/bundled
	github.com/microsoft/typescript-go/shim/checker => ../../../../samchon/ttsc/packages/ttsc/shim/checker
	github.com/microsoft/typescript-go/shim/compiler => ../../../../samchon/ttsc/packages/ttsc/shim/compiler
	github.com/microsoft/typescript-go/shim/core => ../../../../samchon/ttsc/packages/ttsc/shim/core
	github.com/microsoft/typescript-go/shim/diagnosticwriter => ../../../../samchon/ttsc/packages/ttsc/shim/diagnosticwriter
	github.com/microsoft/typescript-go/shim/parser => ../../../../samchon/ttsc/packages/ttsc/shim/parser
	github.com/microsoft/typescript-go/shim/scanner => ../../../../samchon/ttsc/packages/ttsc/shim/scanner
	github.com/microsoft/typescript-go/shim/tsoptions => ../../../../samchon/ttsc/packages/ttsc/shim/tsoptions
	github.com/microsoft/typescript-go/shim/tspath => ../../../../samchon/ttsc/packages/ttsc/shim/tspath
	github.com/microsoft/typescript-go/shim/vfs => ../../../../samchon/ttsc/packages/ttsc/shim/vfs
	github.com/samchon/ttsc/packages/lint => ../../../../samchon/ttsc/packages/lint
	github.com/samchon/ttsc/packages/ttsc => ../../../../samchon/ttsc/packages/ttsc
)
