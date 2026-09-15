import { EvidTypeScriptAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Rejects TypeScript reexports that escape their population root.
 *
 * Logical and physical roots both bound the selected public population.
 *
 * 1. Analyze reexports crossing each root boundary.
 * 2. Require incomplete status and the corresponding diagnostic.
 */
export async function test_typescript_root_boundary(): Promise<void> {
  const inside = EvidTestSourceSnapshot.create(
    "api/index.ts",
    'export { value } from "../outside/value";',
    undefined,
    "/project",
  );
  inside.root.absolute = "/project/api";
  inside.root.physical = "/project/api";
  const outside = EvidTestSourceSnapshot.create(
    "outside/value.ts",
    "export const value = 1;",
  );

  const logical = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.combine([inside, outside]),
  );

  TestValidator.equals("logical escape is incomplete", logical.complete, false);
  TestValidator.predicate(
    "logical root cause",
    logical.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("leaves the declared source root"),
    ),
  );

  // A logical alias inside the root cannot hide a physical target outside it.
  const linkedInside = EvidTestSourceSnapshot.create(
    "api/index.ts",
    'export { value } from "./linked/value";',
    undefined,
    "/project",
  );
  linkedInside.root.absolute = "/project/api";
  linkedInside.root.physical = "/project/api";
  const linkedOutside = EvidTestSourceSnapshot.create(
    "api/linked/value.ts",
    "export const value = 1;",
  );
  const linkedSource = linkedOutside.files[0];
  if (linkedSource === undefined)
    throw new Error("Missing linked source fixture.");
  linkedSource.physicalPath = "/outside/value.ts";

  const physical = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.combine([linkedInside, linkedOutside]),
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
