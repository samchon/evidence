import {
  EvidenceAccessor,
  EvidenceCAdapter,
  EvidenceCSharpAdapter,
  EvidenceCppAdapter,
  EvidenceGoAdapter,
  EvidenceJavaAdapter,
  EvidenceJavaScriptAdapter,
  EvidenceKotlinAdapter,
  EvidencePythonAdapter,
  EvidenceRubyAdapter,
  EvidenceRustAdapter,
  EvidenceTypeScriptAdapter,
  EvidenceZigAdapter,
} from "@wrtnlabs/evidence";
import type {
  EvidenceProgrammingSymbol,
  IEvidenceWithdrawal,
} from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";

import type { IAdapterCertification } from "./IAdapterCertification";
import type { IAdapterCertificationAddress } from "./IAdapterCertificationAddress";
import type { IAdapterCertificationRequirement } from "./IAdapterCertificationRequirement";
import type { IAdapterCertificationUnit } from "./IAdapterCertificationUnit";

/** Supplies the complete fixture contract for every initially certified language. */
export namespace AdapterCertificationFixtures {
  export function all(): IAdapterCertification[] {
    return [
      typescript(),
      javascript(),
      python(),
      go(),
      rust(),
      java(),
      kotlin(),
      zig(),
      csharp(),
      c(),
      cpp(),
      ruby(),
    ];
  }

  function typescript(): IAdapterCertification {
    const file = "src/certification.ts";
    return {
      type: "typescript",
      adapter: new EvidenceTypeScriptAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            export class Contract {
              /**
               * 실행 한글
               * @evidence docs/requirements.md#function Implements the certified function.
               */
              public run(): number { return 1; }

              /**
               * 값 한글
               * @evidence docs/requirements.md#property Implements the certified property.
               */
              public value = 1;

              private hidden = 0;

              /** @internal Retired public contract. */
              public legacy = 1;
            }

            export { Contract as ContractAlias };
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"], undefined, [["ContractAlias"]]),
        unit(
          file,
          "function",
          ["Contract", "prototype", "run"],
          ["Contract"],
          [["ContractAlias", "prototype", "run"]],
        ),
        unit(
          file,
          "property",
          ["Contract", "prototype", "value"],
          ["Contract"],
          [["ContractAlias", "prototype", "value"]],
        ),
        unit(
          file,
          "property",
          ["Contract", "prototype", "legacy"],
          ["Contract"],
          [["ContractAlias", "prototype", "legacy"]],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "prototype", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "prototype", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "prototype", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.ts",
            content: "const contract = {}; export = contract;",
          },
        ],
        diagnosticCodes: ["typescript-export-assignment"],
      },
      malformed: {
        sources: [
          { file: "src/malformed.ts", content: "export interface Broken {" },
        ],
        diagnosticCodes: ["typescript-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.ts",
          content: dedent`
            /** @evidence docs/requirements.md#attached Attached documentation. */
            export function run(): string {
              // @evidence docs/requirements.md#comment Ordinary comments are inert.
              return "@evidence docs/requirements.md#literal Literal text is inert.";
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 1,
      },
      mutation: mutation(
        key("function", ["Contract", "prototype", "run"]),
        "public run(): number { return 1; }",
        "public run(): number { return 2; }",
      ),
    };
  }

  function javascript(): IAdapterCertification {
    const file = "src/certification.mjs";
    return {
      type: "javascript",
      adapter: new EvidenceJavaScriptAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            export class Contract {
              /**
               * 실행 한글
               * @evidence docs/requirements.md#function Implements the certified function.
               */
              run() { return 1; }

              /**
               * 값 한글
               * @evidence docs/requirements.md#property Implements the certified property.
               */
              value = 1;

              #hidden = 0;

              /** @internal Retired public contract. */
              legacy = 1;
            }
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "prototype", "run"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "prototype", "value"],
          ["Contract"],
        ),
        unit(
          file,
          "property",
          ["Contract", "prototype", "legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "prototype", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "prototype", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "prototype", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.cjs",
            content: dedent`
              const name = "run";
              function run() {}
              exports[name] = run;
            `,
          },
        ],
        diagnosticCodes: ["javascript-commonjs-computed"],
      },
      malformed: {
        sources: [
          { file: "src/malformed.mjs", content: "export class Broken {" },
        ],
        diagnosticCodes: ["javascript-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.mjs",
          content: dedent`
            /** @evidence docs/requirements.md#attached Attached documentation. */
            export function run() {
              // @evidence docs/requirements.md#comment Ordinary comments are inert.
              return "@evidence docs/requirements.md#literal Literal text is inert.";
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 1,
      },
      mutation: mutation(
        key("function", ["Contract", "prototype", "run"]),
        "run() { return 1; }",
        "run() { return 2; }",
      ),
    };
  }

  function python(): IAdapterCertification {
    const file = "src/certification.py";
    return {
      type: "python",
      adapter: new EvidencePythonAdapter(),
      sources: [
        {
          file,
          content: dedent`
            # 계약 한글
            # @evidence docs/requirements.md#type Implements the certified type.
            class Contract:
                def run(self):
                    """
                    실행 한글
                    @evidence docs/requirements.md#function Implements the certified function.
                    """
                    return 1

                # 값 한글
                # @evidence docs/requirements.md#property Implements the certified property.
                value = 1

                _hidden = 0

                # @internal Retired public contract.
                legacy = 1
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "prototype", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "prototype", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "_hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.py",
            content: dedent`
              public = 1
              __all__ = ["public"]
              __all__.append(runtime_name)
            `,
          },
        ],
        diagnosticCodes: ["python-dynamic-all"],
      },
      malformed: {
        sources: [
          { file: "src/malformed.py", content: "def broken(:\n    pass\n" },
        ],
        diagnosticCodes: ["python-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.py",
          content: dedent`
            # @evidence docs/requirements.md#attached Attached documentation.
            def run():
                # @evidence docs/requirements.md#comment Body comments are inert.
                return "@evidence docs/requirements.md#literal Literal text is inert."
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 1,
      },
      mutation: mutation(
        key("function", ["Contract", "prototype", "run"]),
        "return 1",
        "return 2",
      ),
    };
  }

  function go(): IAdapterCertification {
    const file = "src/certification.go";
    return {
      type: "go",
      adapter: new EvidenceGoAdapter(),
      sources: [
        {
          file,
          content: dedent`
            package certification

            // 계약 한글
            // @evidence docs/requirements.md#type Implements the certified type.
            type Contract struct {
                // 값 한글
                // @evidence docs/requirements.md#property Implements the certified property.
                Value int
                hidden int
            }

            // 실행 한글
            // @evidence docs/requirements.md#function Implements the certified function.
            func (Contract) Run() int { return 1 }

            // @internal Retired public contract.
            var Legacy = 1
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"], undefined, [], [], 2),
        unit(file, "function", ["Contract", "Run"], ["Contract"]),
        unit(file, "property", ["Contract", "Value"], ["Contract"]),
        unit(file, "property", ["Legacy"], undefined, [], ["internal"], 2),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "Run"]),
        key("property", ["Contract", "Value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "Run"]),
        key("property", ["Contract", "Value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.go",
            content: "package certification\nfunc (Missing) Run() {}\n",
          },
        ],
        diagnosticCodes: ["go-receiver"],
      },
      malformed: {
        sources: [
          {
            file: "src/malformed.go",
            content: "package certification\nfunc Broken( {\n",
          },
        ],
        diagnosticCodes: ["go-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.go",
          content: dedent`
            package certification

            // @evidence docs/requirements.md#attached Attached documentation.
            func Run() string {
                // @evidence docs/requirements.md#comment Body comments are inert.
                return "@evidence docs/requirements.md#literal Literal text is inert."
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "Run"]),
        "func (Contract) Run() int { return 1 }",
        "func (Contract) Run() int { return 2 }",
      ),
    };
  }

  function rust(): IAdapterCertification {
    const file = "src/certification.rs";
    return {
      type: "rust",
      adapter: new EvidenceRustAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /// 계약 한글
            /// @evidence docs/requirements.md#type Implements the certified type.
            pub struct Contract {
                /// 값 한글
                /// @evidence docs/requirements.md#property Implements the certified property.
                pub value: i32,
                hidden: i32,
            }

            impl Contract {
                /// 실행 한글
                /// @evidence docs/requirements.md#function Implements the certified function.
                pub fn run(&self) -> i32 { 1 }

                /// @internal Retired public contract.
                pub const LEGACY: i32 = 1;
            }
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "LEGACY"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.rs",
            content: dedent`
              #[cfg(feature = "conditional")]
              pub struct Conditional;
            `,
          },
        ],
        diagnosticCodes: ["rust-conditional-item"],
      },
      malformed: {
        sources: [{ file: "src/malformed.rs", content: "pub fn broken( {\n" }],
        diagnosticCodes: ["rust-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.rs",
          content: dedent`
            /// @evidence docs/requirements.md#attached Attached documentation.
            pub fn run() -> &'static str {
                // @evidence docs/requirements.md#comment Ordinary comments are inert.
                "@evidence docs/requirements.md#literal Literal text is inert."
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "pub fn run(&self) -> i32 { 1 }",
        "pub fn run(&self) -> i32 { 2 }",
      ),
    };
  }

  function java(): IAdapterCertification {
    const file = "src/Contract.java";
    return {
      type: "java",
      adapter: new EvidenceJavaAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            public class Contract {
                /**
                 * 실행 한글
                 * @evidence docs/requirements.md#function Implements the certified function.
                 */
                public int run() { return 1; }

                /**
                 * 값 한글
                 * @evidence docs/requirements.md#property Implements the certified property.
                 */
                public int value = 1;

                private int hidden = 0;

                /** @internal Retired public contract. */
                public static final int LEGACY = 1;
            }
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "LEGACY"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/first/Conflict.java",
            content: "public class Conflict {}\n",
          },
          {
            file: "src/second/Conflict.java",
            content: "public class Conflict {}\n",
          },
        ],
        diagnosticCodes: ["java-declaration-conflict"],
      },
      malformed: {
        sources: [
          {
            file: "src/Malformed.java",
            content: "public class Malformed { public void run( { }\n",
          },
        ],
        diagnosticCodes: ["java-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/FalsePositive.java",
          content: dedent`
            public class FalsePositive {
                /** @evidence docs/requirements.md#attached Attached documentation. */
                public String run() {
                    // @evidence docs/requirements.md#comment Ordinary comments are inert.
                    return "@evidence docs/requirements.md#literal Literal text is inert.";
                }
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "public int run() { return 1; }",
        "public int run() { return 2; }",
      ),
    };
  }

  /** Supplies exact Kotlin declarations and counterexamples for the common certification gates. */
  function kotlin(): IAdapterCertification {
    const file = "src/Contract.kt";
    return {
      type: "kotlin",
      adapter: new EvidenceKotlinAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            class Contract {
                /**
                 * 실행 한글
                 * @evidence docs/requirements.md#function Implements the certified function.
                 */
                fun run(): Int { return 1 }

                /**
                 * 값 한글
                 * @evidence docs/requirements.md#property Implements the certified property.
                 */
                val value = 1

                private val hidden = 0

                /** @internal Retired public contract. */
                val LEGACY = 1
            }
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "LEGACY"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/first/Conflict.kt",
            content: "class Conflict {}\n",
          },
          {
            file: "src/second/Conflict.kt",
            content: "class Conflict {}\n",
          },
        ],
        diagnosticCodes: ["kotlin-declaration-conflict"],
      },
      malformed: {
        sources: [
          {
            file: "src/Malformed.kt",
            content: "class Malformed { fun run( { }\n",
          },
        ],
        diagnosticCodes: ["kotlin-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/FalsePositive.kt",
          content: dedent`
            class FalsePositive {
                /** @evidence docs/requirements.md#attached Attached documentation. */
                fun run(): String {
                    // @evidence docs/requirements.md#comment Ordinary comments are inert.
                    return "@evidence docs/requirements.md#literal Literal text is inert."
                }
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "fun run(): Int { return 1 }",
        "fun run(): Int { return 2 }",
      ),
    };
  }

  function zig(): IAdapterCertification {
    const file = "src/certification.zig";
    return {
      type: "zig",
      adapter: new EvidenceZigAdapter(),
      sources: [
        {
          file,
          content: dedent`
        /// 계약 🔎
        /// @evidence docs/requirements.md#type Implements the certified type.
        pub const Contract = struct {
          /// 계약 🔎
          /// @evidence docs/requirements.md#function Implements the certified function.
          pub fn run() i32 { return 1; }
          /// 값 🔎
          /// @evidence docs/requirements.md#property Implements the certified property.
          value: i32,
          const hidden = 0;
          /// @internal Retired public contract.
          pub const legacy = 1;
        };
      `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.zig",
            content: 'pub usingnamespace @import("other.zig");',
          },
        ],
        diagnosticCodes: ["zig-usingnamespace"],
      },
      malformed: {
        sources: [{ file: "src/malformed.zig", content: "pub fn broken( {" }],
        diagnosticCodes: ["zig-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.zig",
          content: dedent`
          /// @evidence docs/requirements.md#attached Attached documentation.
          pub fn run() []const u8 {
            // @evidence docs/requirements.md#comment Ordinary comments are inert.
            return "@evidence docs/requirements.md#literal Literal text is inert.";
          }
        `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "pub fn run() i32 { return 1; }",
        "pub fn run() i32 { return 2; }",
      ),
    };
  }

  function csharp(): IAdapterCertification {
    const file = "src/Contract.cs";
    return {
      type: "csharp",
      adapter: new EvidenceCSharpAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /// 계약 한글
            /// @evidence docs/requirements.md#type Implements the certified type.
            public class Contract
            {
                /// 실행 한글
                /// @evidence docs/requirements.md#function Implements the certified function.
                public int Run() { return 1; }

                /// 값 한글
                /// @evidence docs/requirements.md#property Implements the certified property.
                public int Value { get; set; } = 1;

                private int Hidden { get; set; }

                /// @internal Retired public contract.
                public int Legacy { get; set; } = 1;
            }
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "Run"], ["Contract"]),
        unit(file, "property", ["Contract", "Value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "Legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "Run"]),
        key("property", ["Contract", "Value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "Run"]),
        key("property", ["Contract", "Value"]),
      ),
      excludedUnits: [key("property", ["Contract", "Hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/Incomplete.cs",
            content: dedent`
              #if DEBUG
              public class DebugContract { }
              #else
              public class ReleaseContract { }
              #endif
            `,
          },
        ],
        diagnosticCodes: ["csharp-preprocessor-conditional"],
      },
      malformed: {
        sources: [
          {
            file: "src/Malformed.cs",
            content: "public class Malformed { public void Run( { }\n",
          },
        ],
        diagnosticCodes: ["csharp-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/FalsePositive.cs",
          content: dedent`
            public class FalsePositive
            {
                /// @evidence docs/requirements.md#attached Attached documentation.
                public string Run()
                {
                    // @evidence docs/requirements.md#comment Ordinary comments are inert.
                    return "@evidence docs/requirements.md#literal Literal text is inert.";
                }
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "Run"]),
        "public int Run() { return 1; }",
        "public int Run() { return 2; }",
      ),
    };
  }

  function c(): IAdapterCertification {
    const file = "src/certification.c";
    return {
      type: "c",
      adapter: new EvidenceCAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            struct Contract {
                /**
                 * 값 한글
                 * @evidence docs/requirements.md#property Implements the certified property.
                 */
                int value;
            };

            /**
             * 실행 한글
             * @evidence docs/requirements.md#function Implements the certified function.
             */
            int run(void) { return 1; }

            static int hidden;

            /** @internal Retired public contract. */
            int legacy = 1;
          `,
        },
      ],
      units: [
        unit(file, "type", ["struct Contract"], undefined, [["Contract"]]),
        unit(file, "function", ["run"]),
        unit(
          file,
          "property",
          ["struct Contract", "value"],
          ["struct Contract"],
          [["Contract", "value"]],
        ),
        unit(file, "property", ["legacy"], undefined, [], ["internal"]),
      ],
      hosts: hosts(
        key("type", ["struct Contract"]),
        key("function", ["run"]),
        key("property", ["struct Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["struct Contract"]),
        key("function", ["run"]),
        key("property", ["struct Contract", "value"]),
      ),
      excludedUnits: [key("property", ["hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.c",
            content: dedent`
              #if DEBUG
              int debug_value;
              #else
              int release_value;
              #endif
            `,
          },
        ],
        diagnosticCodes: ["c-preprocessor-conditional"],
      },
      malformed: {
        sources: [
          { file: "src/malformed.c", content: "int broken( { return 0; }\n" },
        ],
        diagnosticCodes: ["c-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.c",
          content: dedent`
            /** @evidence docs/requirements.md#attached Attached documentation. */
            const char *run(void) {
                // @evidence docs/requirements.md#comment Ordinary comments are inert.
                return "@evidence docs/requirements.md#literal Literal text is inert.";
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["run"]),
        "int run(void) { return 1; }",
        "int run(void) { return 2; }",
      ),
    };
  }

  function cpp(): IAdapterCertification {
    const file = "src/certification.cpp";
    return {
      type: "cpp",
      adapter: new EvidenceCppAdapter(),
      sources: [
        {
          file,
          content: dedent`
            /**
             * 계약 한글
             * @evidence docs/requirements.md#type Implements the certified type.
             */
            class Contract {
            public:
                /**
                 * 실행 한글
                 * @evidence docs/requirements.md#function Implements the certified function.
                 */
                int run() const { return 1; }

                /**
                 * 값 한글
                 * @evidence docs/requirements.md#property Implements the certified property.
                 */
                int value;

                /** @internal Retired public contract. */
                int legacy;

            private:
                int hidden;
            };
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.cpp",
            content: dedent`
              #if DEBUG
              int debug_value;
              #else
              int release_value;
              #endif
            `,
          },
        ],
        diagnosticCodes: ["cpp-preprocessor-conditional"],
      },
      malformed: {
        sources: [
          {
            file: "src/malformed.cpp",
            content: "class Broken { public: int run( { return 0; }\n",
          },
        ],
        diagnosticCodes: ["cpp-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.cpp",
          content: dedent`
            /** @evidence docs/requirements.md#attached Attached documentation. */
            const char *run() {
                // @evidence docs/requirements.md#comment Ordinary comments are inert.
                return "@evidence docs/requirements.md#literal Literal text is inert.";
            }
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "int run() const { return 1; }",
        "int run() const { return 2; }",
      ),
    };
  }

  function ruby(): IAdapterCertification {
    const file = "src/certification.rb";
    return {
      type: "ruby",
      adapter: new EvidenceRubyAdapter(),
      sources: [
        {
          file,
          content: dedent`
            # 계약 한글
            # @evidence docs/requirements.md#type Implements the certified type.
            class Contract
              # 실행 한글
              # @evidence docs/requirements.md#function Implements the certified function.
              def run; 1; end

              # 값 한글
              # @evidence docs/requirements.md#property Implements the certified property.
              attr_reader :value

              private
              attr_reader :hidden
              public

              # @internal Retired public contract.
              attr_reader :legacy
            end
          `,
        },
      ],
      units: [
        unit(file, "type", ["Contract"]),
        unit(file, "function", ["Contract", "run"], ["Contract"]),
        unit(file, "property", ["Contract", "value"], ["Contract"]),
        unit(
          file,
          "property",
          ["Contract", "legacy"],
          ["Contract"],
          [],
          ["internal"],
        ),
      ],
      hosts: hosts(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      requirements: requirements(
        key("type", ["Contract"]),
        key("function", ["Contract", "run"]),
        key("property", ["Contract", "value"]),
      ),
      excludedUnits: [key("property", ["Contract", "hidden"])],
      annotationRanges: 4,
      incomplete: {
        sources: [
          {
            file: "src/incomplete.rb",
            content: dedent`
              class Dynamic
                define_method(name) { }
              end
            `,
          },
        ],
        diagnosticCodes: ["ruby-dynamic-surface"],
      },
      malformed: {
        sources: [{ file: "src/malformed.rb", content: "module Broken\n" }],
        diagnosticCodes: ["ruby-parse-incomplete"],
      },
      falsePositive: {
        source: {
          file: "src/false-positive.rb",
          content: dedent`
            class FalsePositive
              # @evidence docs/requirements.md#attached Attached documentation.
              def run
                # @evidence docs/requirements.md#comment Body comments are inert.
                "@evidence docs/requirements.md#literal Literal text is inert."
              end
            end
          `,
        },
        attachedTarget: "docs/requirements.md#attached",
        unsupportedAnnotations: 2,
      },
      mutation: mutation(
        key("function", ["Contract", "run"]),
        "def run; 1; end",
        "def run; 2; end",
      ),
    };
  }

  function unit(
    file: string,
    symbol: EvidenceProgrammingSymbol,
    identity: string[],
    parent?: string[],
    aliases: string[][] = [],
    withdrawals: IEvidenceWithdrawal["tag"][] = [],
    sites: number = 1,
  ): IAdapterCertificationUnit {
    const addresses: IAdapterCertificationAddress[] = [
      identity,
      ...aliases,
    ].map((segments) => ({
      file,
      accessor: EvidenceAccessor.format(segments),
    }));
    return {
      key: key(symbol, identity),
      symbol,
      identity,
      ...(parent === undefined ? {} : { parent: key("type", parent) }),
      sites,
      addresses,
      withdrawals,
    };
  }

  function hosts(
    type: string,
    callable: string,
    property: string,
  ): IAdapterCertification["hosts"] {
    return [type, callable, property].map((unitKey) => ({
      attachment: "attached",
      units: [unitKey],
    }));
  }

  function requirements(
    type: string,
    callable: string,
    property: string,
  ): IAdapterCertificationRequirement[] {
    return [
      { unit: type, target: "docs/requirements.md#type" },
      { unit: callable, target: "docs/requirements.md#function" },
      { unit: property, target: "docs/requirements.md#property" },
    ];
  }

  function mutation(
    unitKey: string,
    contentBefore: string,
    contentAfter: string,
  ): IAdapterCertification["mutation"] {
    return {
      unit: unitKey,
      reasonBefore: "Implements the certified function.",
      reasonAfter: "Explains the certified function differently.",
      contentBefore,
      contentAfter,
    };
  }

  function key(symbol: EvidenceProgrammingSymbol, identity: string[]): string {
    return `${symbol}:${EvidenceAccessor.format(identity)}`;
  }
}
