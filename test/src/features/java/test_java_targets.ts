import { EvidenceJavaAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Resolves Java owners, nested declarations, properties, and overload families.
 *
 * Exact target paths preserve class ownership and overload grouping.
 *
 * 1. Analyze nested Java declarations.
 * 2. Resolve valid paths.
 * 3. Require missing or ambiguous paths to retain their statuses.
 */
export async function test_java_targets(): Promise<void> {
  const adapter = new EvidenceJavaAdapter();

  // Package identity stays semantic; file targets begin at the top-level type.
  const reference = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/main/com/example/Sale.java",
        dedent`
          package com.example;

          public class Sale {
              public int total;

              public int calculate() { return 0; }
              public int calculate(int value) { return value; }

              public static class Metadata {
                  public String label;
              }
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/main/com/example/Point.java",
        "package com.example; public record Point(int x) {}\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/main/com/example/State.java",
        "package com.example; public enum State { READY }\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/main/com/example/Label.java",
        "package com.example; public @interface Label { String value(); }\n",
      ),
    ]),
  );
  const claim = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/test/Verify.java",
      dedent`
        public class Verify {
            /**
             * @evidence ../main/com/example/Sale.java#Sale Verifies the public type.
             * @evidence ../main/com/example/Sale.java#Sale.total Verifies the public field.
             * @evidence ../main/com/example/Sale.java#Sale.calculate Verifies every overload.
             * @evidence ../main/com/example/Sale.java#Sale.Metadata Verifies the nested type.
             * @evidence ../main/com/example/Sale.java#Sale.Metadata.label Verifies the nested field.
             * @evidence ../main/com/example/Point.java#Point.x Verifies the record component.
             * @evidence ../main/com/example/State.java#State.READY Verifies the enum constant.
             * @evidence ../main/com/example/Label.java#Label.value Verifies the annotation element.
             */
            public void verify() {}
        }
      `,
    ),
  );

  TestValidator.equals(
    "complete Java target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete Java target claim", claim.diagnostics, []);
  const resolutions = await EvidenceTestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "resolved Java targets",
    resolutions.map((resolution) => resolution.resolution.status),
    [
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
    ],
  );

  // One method-name target resolves the overload family with every declaration site.
  const calculationDeclaration = claim.declarations.find((declaration) =>
    declaration.target.endsWith("#Sale.calculate"),
  );
  if (calculationDeclaration === undefined)
    throw new Error("Missing Java overload target declaration.");
  const calculationResolution = resolutions.find(
    (resolution) => resolution.declarationId === calculationDeclaration.id,
  );
  if (calculationResolution === undefined)
    throw new Error("Missing Java overload target resolution.");
  const calculation = calculationResolution.resolution.units[0];
  if (calculation === undefined)
    throw new Error("Missing resolved Java overload family.");
  TestValidator.equals(
    "Java overload target sites",
    calculation.sites.length,
    2,
  );
  TestValidator.equals("Java package identity", calculation.identity, [
    "com",
    "example",
    "Sale",
    "calculate",
  ]);

  // Java permits a field and method with one name; the configured symbol population disambiguates them.
  const collisionReference = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/main/Collision.java",
      dedent`
        public class Collision {
            public int value;
            public int value() { return value; }
        }
      `,
    ),
  );
  const collisionClaim = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/test/CollisionTest.java",
      dedent`
        public class CollisionTest {
            /** @evidence ../main/Collision.java#Collision.value Verifies one selected namespace. */
            public void verify() {}
        }
      `,
    ),
  );
  for (const symbol of ["function", "property"]) {
    const selected = collisionReference.units.filter(
      (unit) => unit.symbol === symbol,
    );
    const selectedResolutions = await EvidenceTestGraph.resolveDeclarations(
      collisionClaim,
      collisionReference,
      selected.map((unit) => unit.id),
    );
    TestValidator.equals(
      `resolved Java ${symbol} namespace`,
      selectedResolutions.map((resolution) => resolution.resolution.status),
      ["resolved"],
    );
  }
  const ambiguous = await EvidenceTestGraph.resolveDeclarations(
    collisionClaim,
    collisionReference,
    collisionReference.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "ambiguous Java member namespaces",
    ambiguous.map((resolution) => resolution.resolution.status),
    ["ambiguous"],
  );
}
