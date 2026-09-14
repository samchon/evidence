import { TestValidator } from "@nestia/e2e";

import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Rejects reexports that escape either the logical or physical population root. */
export async function test_typescript_root_boundary(): Promise<void> {
  const inside = TestSourceSnapshot.create(
    "api/index.ts",
    'export { value } from "../outside/value";',
    undefined,
    "/project",
  );
  inside.root.absolute = "/project/api";
  inside.root.physical = "/project/api";
  const outside = TestSourceSnapshot.create(
    "outside/value.ts",
    "export const value = 1;",
  );

  const logical = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([inside, outside]),
  );

  TestValidator.equals("logical escape is incomplete", logical.complete, false);
  TestValidator.predicate(
    "logical root cause",
    logical.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("leaves the declared source root"),
    ),
  );

  // A logical alias inside the root cannot hide a physical target outside it.
  const linkedInside = TestSourceSnapshot.create(
    "api/index.ts",
    'export { value } from "./linked/value";',
    undefined,
    "/project",
  );
  linkedInside.root.absolute = "/project/api";
  linkedInside.root.physical = "/project/api";
  const linkedOutside = TestSourceSnapshot.create(
    "api/linked/value.ts",
    "export const value = 1;",
  );
  const linkedSource = linkedOutside.files[0];
  if (linkedSource === undefined)
    throw new Error("Missing linked source fixture.");
  linkedSource.physicalPath = "/outside/value.ts";

  const physical = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([linkedInside, linkedOutside]),
  );

  TestValidator.equals(
    "physical escape is incomplete",
    physical.complete,
    false,
  );
  TestValidator.predicate(
    "physical root cause",
    physical.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("leaves the declared source root"),
    ),
  );
}
