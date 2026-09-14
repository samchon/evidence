import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTargetResolver } from "../../../../packages/evidence/src/targets/EvidenceTargetResolver";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceTargetStatement } from "../../../../packages/evidence/src/structures/IEvidenceTargetStatement";
import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps missing, unselected, withdrawn, ambiguous, and incomplete targets distinct. */
export async function test_target_failures(): Promise<void> {
  const location = join(__dirname, "failures-" + randomUUID());

  await TestFileSystem.experiment(
    location,
    { "src/outside.ts": "export const value = 1;" },
    async (directory) => {
      const root = directory.replaceAll("\\", "/");
      const host = createHost(root + "/docs/review.md");
      const selected = await new EvidenceTypeScriptAdapter().analyze(
        TestSourceSnapshot.create(
          "src/selected.ts",
          "export const value = 1;",
          undefined,
          root,
        ),
      );
      const resolver = new EvidenceTargetResolver([selected]);
      const ids = selected.units.map((unit) => unit.id);

      // Filesystem existence distinguishes a wrong selection from a missing path.
      const outside = await resolver.resolve(
        createStatement("../src/outside.ts#value", root),
        host,
        ids,
      );
      const missing = await resolver.resolve(
        createStatement("../src/missing.ts#value", root),
        host,
        ids,
      );

      TestValidator.equals(
        "out-of-population file",
        outside.status,
        "out-of-population",
      );
      TestValidator.equals("missing file", missing.status, "missing-file");

      // Programming target syntax is validated after the reference kind is known.
      const malformedPercent = await resolver.resolve(
        createStatement("../src/bad%ZZ.ts#value", root),
        host,
        ids,
      );
      const malformedAccessor = await resolver.resolve(
        createStatement("../src/selected.ts#A.[0]", root),
        host,
        ids,
      );
      const malformedNul = await resolver.resolve(
        createStatement("../src/bad%00.ts#value", root),
        host,
        ids,
      );

      TestValidator.equals(
        "malformed programming targets",
        [
          malformedPercent.status,
          malformedAccessor.status,
          malformedNul.status,
        ],
        ["malformed", "malformed", "malformed"],
      );

      // An unsupported documentation position cannot manufacture an edge.
      const unsupported = structuredClone(host);
      unsupported.attachment = "unsupported";
      delete unsupported.siteId;
      unsupported.unitIds = [];
      unsupported.problem = "Move the tag into declaration documentation.";
      const unsupportedResult = await resolver.resolve(
        createStatement("../src/selected.ts#value", root),
        unsupported,
        ids,
      );

      TestValidator.equals(
        "unsupported host",
        unsupportedResult.status,
        "unsupported-host",
      );
    },
  );

  // Withdrawn declarations retain their identity and withdrawal cause.
  const hiddenInventory = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/hidden.ts",
      "/** @internal */\nexport function hidden(): void {}",
    ),
  );
  const hiddenResolver = new EvidenceTargetResolver([hiddenInventory]);
  const hidden = await hiddenResolver.resolve(
    createStatement("../src/hidden.ts#hidden", "/project"),
    createHost("/project/docs/review.md"),
    hiddenInventory.units.map((unit) => unit.id),
  );

  TestValidator.equals("withdrawn target", hidden.status, "hidden");
  TestValidator.equals(
    "withdrawal metadata",
    hidden.withdrawals.map((withdrawal) => withdrawal.tag),
    ["internal"],
  );

  // Competing star exports remain ambiguous instead of choosing scan order.
  const ambiguousInventory = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/a.ts", "export const value = 1;"),
      TestSourceSnapshot.create("src/b.ts", "export const value = 2;"),
      TestSourceSnapshot.create(
        "src/index.ts",
        'export * from "./a"; export * from "./b";',
      ),
    ]),
  );
  const ambiguous = await new EvidenceTargetResolver([
    ambiguousInventory,
  ]).resolve(
    createStatement("../src/index.ts#value", "/project"),
    createHost("/project/docs/review.md"),
    ambiguousInventory.units.map((unit) => unit.id),
  );

  TestValidator.equals("ambiguous address", ambiguous.status, "ambiguous");

  // Any export-analysis failure prevents an otherwise valid address from covering.
  const incompleteInventory = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/value.ts", "export const value = 1;"),
      TestSourceSnapshot.create(
        "src/index.ts",
        'export { value, missing } from "./value";',
      ),
    ]),
  );
  const incomplete = await new EvidenceTargetResolver([
    incompleteInventory,
  ]).resolve(
    createStatement("../src/index.ts#value", "/project"),
    createHost("/project/docs/review.md"),
    incompleteInventory.units.map((unit) => unit.id),
  );
  const incompleteMissing = await new EvidenceTargetResolver([
    incompleteInventory,
  ]).resolve(
    createStatement("../src/absent.ts#value", "/project"),
    createHost("/project/docs/review.md"),
    incompleteInventory.units.map((unit) => unit.id),
  );

  TestValidator.equals(
    "incomplete export graph",
    incomplete.status,
    "incomplete",
  );
  TestValidator.predicate(
    "underlying export cause retained",
    incomplete.diagnostics.some(
      (diagnostic) => diagnostic.code === "typescript-export",
    ),
  );
  TestValidator.equals(
    "incomplete graph suppresses derivative misses",
    incompleteMissing.status,
    "incomplete",
  );
}

function createHost(file: string): IEvidenceHost {
  return {
    id: "claim-host",
    file,
    range: {
      start: { line: 0, column: 0, offset: 0 },
      end: { line: 0, column: 0, offset: 0 },
    },
    origins: [file],
    siteId: "claim-site",
    unitIds: ["claim-unit"],
    attachment: "attached",
  };
}

function createStatement(
  target: string,
  root: string,
): IEvidenceTargetStatement {
  return {
    hostId: "claim-host",
    target,
    location: { file: root + "/docs/review.md" },
  };
}
