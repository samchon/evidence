import { EvidenceCSharpAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Reports C# partial, preprocessing, and syntax uncertainty without
 * compilation.
 *
 * Conflicting identities and undecidable source forms must leave an incomplete
 * inventory instead of a passing smaller population.
 *
 * 1. Analyze conflicting partial declarations and sources separated by
 *    preprocessor boundaries.
 * 2. Analyze malformed and otherwise unsupported C# forms that prevent static
 *    ownership.
 * 3. Require every affected inventory to be incomplete with a diagnostic.
 */
export async function test_csharp_failures(): Promise<void> {
  const adapter = new EvidenceCSharpAdapter();

  // Duplicate public types must opt into one compatible partial identity.
  const duplicate = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/First.cs",
        "public class Sale {}\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/Second.cs",
        "public class Sale {}\n",
      ),
    ]),
  );
  TestValidator.equals("duplicate C# type", duplicate.complete, false);
  TestValidator.equals(
    "duplicate C# type diagnostic",
    hasCode(duplicate, "csharp-partial-conflict"),
    true,
  );

  // Partial parts cannot disagree about accessibility or declaration form.
  const partialConflict = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Public.cs",
        "public partial class Contract {}\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/Internal.cs",
        "internal partial struct Contract {}\n",
      ),
    ]),
  );
  TestValidator.equals(
    "conflicting C# partial",
    partialConflict.complete,
    false,
  );
  TestValidator.equals(
    "C# partial accessibility diagnostic",
    hasCode(partialConflict, "csharp-partial-accessibility"),
    true,
  );
  TestValidator.equals(
    "C# partial form diagnostic",
    hasCode(partialConflict, "csharp-partial-conflict"),
    true,
  );

  // Record classes and record structs cannot form one partial declaration.
  const recordConflict = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Record.cs",
        "public partial record Contract;\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/RecordStruct.cs",
        "public partial record struct Contract;\n",
      ),
    ]),
  );
  TestValidator.equals(
    "conflicting C# record forms",
    recordConflict.complete,
    false,
  );
  TestValidator.equals(
    "C# record form diagnostic",
    hasCode(recordConflict, "csharp-partial-conflict"),
    true,
  );

  // Tree-sitter cannot choose the active preprocessor branch without build symbols.
  const conditional = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Conditional.cs",
      dedent`
        #if DEBUG
        public class DebugContract { }
        #else
        public class ReleaseContract { }
        #endif
      `,
    ),
  );
  TestValidator.equals("conditional C# source", conditional.complete, false);
  TestValidator.equals(
    "C# preprocessor diagnostic",
    hasCode(conditional, "csharp-preprocessor-conditional"),
    true,
  );
  TestValidator.equals("conditional C# units", conditional.units, []);

  // Explicit interface implementations are reachable through the interface unit only.
  const explicitInterface = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Explicit.cs",
      dedent`
        public interface IService
        {
            void Run();
        }

        public class Service : IService
        {
            void IService.Run() { }
        }

        public interface IAddition<TSelf> where TSelf : IAddition<TSelf>
        {
            static abstract TSelf operator +(TSelf left, TSelf right);
            static abstract explicit operator int(TSelf value);
        }

        public class Number : IAddition<Number>
        {
            static Number IAddition<Number>.operator +(
                Number left,
                Number right
            ) => left;
            static explicit IAddition<Number>.operator int(Number value) => 0;
        }
      `,
    ),
  );
  TestValidator.equals(
    "explicit C# implementation completeness",
    explicitInterface.complete,
    true,
  );
  TestValidator.equals(
    "explicit C# implementation ownership",
    explicitInterface.units
      .map((unit) => unit.identity.join("."))
      .sort(compare),
    [
      "IAddition`1",
      "IAddition`1.explicit operator int",
      "IAddition`1.operator +",
      "IService",
      "IService.Run",
      "Number",
      "Service",
    ],
  );

  // Source generators are not executed; selected declarations remain explicit.
  const generatedBoundary = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Model.cs",
      dedent`
        [GenerateBuilder]
        public partial class Model
        {
            public int Id { get; set; }
        }
      `,
    ),
  );
  TestValidator.equals(
    "annotated C# source",
    generatedBoundary.diagnostics,
    [],
  );
  TestValidator.equals(
    "explicit C# generated boundary",
    generatedBoundary.units
      .map((unit) => unit.identity.join("."))
      .sort(compare),
    ["Model", "Model.Id"],
  );

  // Tree-sitter syntax errors never become a healthy partial inventory.
  const malformed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Broken.cs",
      "public class Broken { public void Run( { }\n",
    ),
  );
  TestValidator.equals("malformed C# source", malformed.complete, false);
  TestValidator.equals(
    "C# parse diagnostic",
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith("csharp-parse-"),
    ),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
