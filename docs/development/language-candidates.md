# Language candidate matrix

This matrix records implementation inputs for formats that are not yet supported. `EvidenceLanguageRegistry.candidates()` is the checked source of the same records. Grammar availability alone does not add a language to `EvidenceLanguageRegistry.list()`.

Every programming language researched here earlier is now certified and documented in [languages.md](../languages.md). Elixir and Erlang were removed from the checked candidate set in #124 when the approved language scope was aligned; restore them to `candidates()` with fresh research before proposing an implementation. The two embedded-format candidates below remain outside the supported count.

## Embedded formats

Embedded formats require source-region extraction and mapped host positions before a JavaScript or TypeScript adapter can analyze their scripts. Their template, style, and data regions do not inherit the programming symbol model from grammar presence.

### Vue single-file component (`vue`)

- Kind: `embedded-format`; dialects: Vue SFC.
- Grammar: [tree-sitter-vue](https://github.com/tree-sitter-grammars/tree-sitter-vue), MIT, `source-build`.
- WASM: No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [SFC syntax specification](https://vuejs.org/api/sfc-spec.html).
- Visibility: component contracts combine script/module exports, script setup macros, template bindings, styles, and custom blocks.
- Declarations: embedded JavaScript/TypeScript regions, component options, defineProps/defineEmits macros, templates, styles, and custom blocks.
- Blockers: embedded regions require offset-preserving extraction; script setup macros need Vue semantics; template and style grammars do not share a programming-symbol model.
- Next task: Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.

### Svelte component (`svelte`)

- Kind: `embedded-format`; dialects: Svelte component.
- Grammar: [tree-sitter-svelte](https://github.com/sveltejs/tree-sitter-svelte), MIT, `source-build`.
- WASM: No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [Svelte files](https://svelte.dev/docs/svelte/svelte-files).
- Visibility: component contracts combine module/instance scripts, exported props or runes, markup, styles, and compiler-generated bindings.
- Declarations: embedded JavaScript/TypeScript regions, component props, module exports, markup, styles, and compiler directives.
- Blockers: embedded regions require offset-preserving extraction; Svelte version semantics change component exports; compiler-generated bindings are not explicit syntax declarations.
- Next task: Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.
