import {
  EvidTargetResolver,
  EvidTypeScriptAdapter,
} from "evid";
import type {
  IEvidHost,
  IEvidTargetStatement,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Distinguishes every unresolved target state.
 *
 * Missing, unselected, malformed, unsupported, withdrawn, ambiguous, and
 * incomplete addresses require different diagnostics and recovery behavior.
 *
 * 1. Resolve an existing unselected file, a missing file, malformed programming
 *    spellings, and a host without a supported attachment.
 * 2. Verify their distinct statuses instead of allowing a guessed edge.
 * 3. Resolve an internal declaration, competing star exports, and an export graph
 *    with a missing source name; require withdrawal metadata, ambiguity, and an
 *    incomplete result that retains the original export diagnostic.
 * 4. Resolve a missing path against that incomplete graph and require incomplete
 *    rather than a derivative missing-file result.
 */
export async function test_target_failures(): Promise<void> {
  const location = join(__dirname, "failures-" + randomUUID());

  await EvidTestFileSystem.experiment(
    location,
    { "src/outside.ts": "export const value = 1;" },
    async (directory) => {
      const root = directory.replaceAll("\\", "/");
      const host = createHost(root + "/docs/review.md");
      const selected = await new EvidTypeScriptAdapter().analyze(
        EvidTestSourceSnapshot.create(
          "src/selected.ts",
          "export const value = 1;",
          undefined,
          root,
        ),
      );
      const resolver = new EvidTargetResolver([selected]);
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
  const hiddenInventory = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/hidden.ts",
      "/** @internal */\nexport function hidden(): void {}",
    ),
  );
  const hiddenResolver = new EvidTargetResolver([hiddenInventory]);
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
  const ambiguousInventory = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create("src/a.ts", "export const value = 1;"),
      EvidTestSourceSnapshot.create("src/b.ts", "export const value = 2;"),
      EvidTestSourceSnapshot.create(
        "src/index.ts",
        'export * from "./a"; export * from "./b";',
      ),
    ]),
  );
  const ambiguous = await new EvidTargetResolver([
    ambiguousInventory,
  ]).resolve(
    createStatement("../src/index.ts#value", "/project"),
    createHost("/project/docs/review.md"),
    ambiguousInventory.units.map((unit) => unit.id),
  );

  TestValidator.equals("ambiguous address", ambiguous.status, "ambiguous");

  // Any export-analysis failure prevents an otherwise valid address from covering.
  const incompleteInventory = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create("src/value.ts", "export const value = 1;"),
      EvidTestSourceSnapshot.create(
        "src/index.ts",
        'export { value, missing } from "./value";',
      ),
    ]),
  );
  const incomplete = await new EvidTargetResolver([
    incompleteInventory,
  ]).resolve(
    createStatement("../src/index.ts#value", "/project"),
    createHost("/project/docs/review.md"),
    incompleteInventory.units.map((unit) => unit.id),
  );
  const incompleteMissing = await new EvidTargetResolver([
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

function createHost(file: string): IEvidHost {
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
): IEvidTargetStatement {
  return {
    hostId: "claim-host",
    target,
    location: { file: root + "/docs/review.md" },
  };
}
