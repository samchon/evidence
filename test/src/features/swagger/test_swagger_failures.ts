import { EvidenceGraph, EvidenceSwaggerAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Keeps Swagger source, parse, validation, and identity failures visible.
 *
 * Failed documents remain active and incomplete until repair so their graph
 * obligations cannot disappear.
 *
 * 1. Analyze each malformed, invalid, and unreadable document.
 * 2. Verify incomplete status and diagnostics.
 * 3. Repair the document and require graph recovery.
 */
export async function test_swagger_failures(): Promise<void> {
  const adapter = new EvidenceSwaggerAdapter();
  const malformed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("malformed.yaml", "openapi: ["),
  );
  const unsupported = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "unsupported.yaml",
      dedent`
        openapi: 9.0.0
        info:
          title: Future
          version: 1.0.0
        paths: {}
      `,
    ),
  );
  const whitespace = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "whitespace.yaml",
      document("/bad path", "get"),
    ),
  );
  const duplicate = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "duplicate.yaml",
      dedent`
        openapi: 3.1.0
        info:
          title: Duplicate
          version: 1.0.0
        paths:
          /members:
            post:
              responses:
                "204":
                  description: Created
            x-additionalOperations:
              post:
                responses:
                  "200":
                    description: Duplicate
      `,
    ),
  );

  rejected("malformed", malformed);
  rejected("unsupported", unsupported);
  rejected("whitespace", whitespace);
  rejected("duplicate", duplicate);

  // One rejected document does not erase valid operations from another source.
  const partial = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create("valid.yaml", document("/health", "get")),
      EvidenceTestSourceSnapshot.create("invalid.yaml", "openapi: ["),
    ]),
  );
  TestValidator.equals(
    "partial inventory remains incomplete",
    partial.complete,
    false,
  );
  TestValidator.equals(
    "partial inventory retains valid operations",
    partial.units.map((unit) => unit.name),
    ["GET:/health"],
  );

  // An incomplete Swagger claim stays active instead of passing as an empty population.
  const graph = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: malformed,
        unitIds: [],
        references: [],
      },
    ],
  });
  const claim = graph.claims[0];
  if (claim === undefined)
    throw new Error("Missing rejected Swagger claim result.");
  TestValidator.equals("rejected claim remains active", claim.active, true);
  TestValidator.equals(
    "rejected claim remains incomplete",
    claim.complete,
    false,
  );
  TestValidator.equals("rejected claim fails the graph", graph.success, false);

  // A corrected document with a new digest succeeds after a cached rejection.
  const repaired = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("malformed.yaml", document("/health", "get")),
  );
  TestValidator.equals(
    "repaired document is complete",
    repaired.complete,
    true,
  );
  TestValidator.equals(
    "repaired document restores operations",
    repaired.units.map((unit) => unit.name),
    ["GET:/health"],
  );

  const location = join(__dirname, "failures-" + randomUUID());
  await EvidenceTestFileSystem.experiment(location, {}, async (directory) => {
    const config = join(directory, "evidence.config.ts");
    const failures: IEvidenceInventory[] = await Promise.all([
      adapter.load(config, "missing.yaml"),
      adapter.load(config, "C:drive-relative.yaml"),
      adapter.load(config, "file:///tmp/openapi.yaml"),
      adapter.load(config, "https://example.com/openapi.yaml#fragment"),
      adapter.load(config, " padded.yaml "),
    ]);

    TestValidator.equals(
      "invalid exact sources fail visibly",
      failures.map((inventory) => inventory.complete),
      [false, false, false, false, false],
    );
    TestValidator.predicate(
      "invalid exact sources report repairs",
      failures.every((inventory) =>
        inventory.diagnostics.some(
          (diagnostic) =>
            diagnostic.severity === "error" && diagnostic.repair !== "",
        ),
      ),
    );
  });
}

function rejected(name: string, inventory: IEvidenceInventory): void {
  TestValidator.equals(
    `${name} document is incomplete`,
    inventory.complete,
    false,
  );
  TestValidator.equals(
    `${name} document has no guessed units`,
    inventory.units,
    [],
  );
  TestValidator.predicate(
    `${name} failure is actionable`,
    inventory.diagnostics.some(
      (diagnostic) => diagnostic.code === "swagger-normalization-failed",
    ),
  );
}

function document(operationPath: string, method: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Health
      version: 1.0.0
    paths:
      ${operationPath}:
        ${method}:
          responses:
            "200":
              description: Healthy
  `;
}
