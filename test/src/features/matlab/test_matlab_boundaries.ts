import { EvidLanguageRegistry, EvidMatlabAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Rejects MATLAB inputs whose public surface cannot be determined safely.
 *
 * Dynamic runtime behavior, malformed declarations, unavailable sources, and
 * unsupported file forms must remain incomplete so they cannot shrink
 * coverage.
 *
 * 1. Analyze dynamic, malformed, duplicate, and unsupported MATLAB sources.
 * 2. Require each inventory to be incomplete with an actionable diagnostic.
 * 3. Verify failed snapshots preserve incompleteness through adapter analysis.
 */
export async function test_matlab_boundaries(): Promise<void> {
  const adapter = new EvidMatlabAdapter();
  for (const content of [
    "classdef Dynamic < dynamicprops\nend\n",
    "function Dynamic()\naddpath('other');\nend\n",
    "function Dynamic()\neval('classdef X');\nend\n",
    "function Dynamic()\nobj=class(struct(),'Legacy');\nend\n",
    "classdef Dynamic\nproperties (Unknown=true)\nvalue\nend\nend\n",
    "classdef Dynamic\nmethods\nfunction value=get.missing(obj)\nvalue=1;\nend\nend\nend\n",
    "classdef Dynamic\nproperties\nvalue\n",
    "classdef Dynamic\nend",
    "value = 1;\n",
    "function Other()\nend\n",
    "function Dynamic()\nendfunction\n",
    "classdef Dynamic\nproperties (Access={calculateAccess()})\nvalue\nend\nend\n",
    "classdef Dynamic\nproperties\nvalue\nvalue\nend\nend\n",
    "@interface Dynamic\n@end\n",
  ]) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create("src/Dynamic.m", content),
    );
    TestValidator.equals(`incomplete ${content}`, inventory.complete, false);
    TestValidator.predicate(
      "actionable diagnostics",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length !== 0,
      ),
    );
  }
  TestValidator.equals(
    "class closing semicolon is a supported delimiter",
    (
      await adapter.analyze(
        EvidTestSourceSnapshot.create(
          "src/Dynamic.m",
          "classdef Dynamic\nend;",
        ),
      )
    ).complete,
    true,
  );
  TestValidator.equals(
    "class introspection does not create a legacy declaration",
    (
      await adapter.analyze(
        EvidTestSourceSnapshot.create(
          "src/Dynamic.m",
          "function value=Dynamic(input)\nvalue=class(input);\nend\n",
        ),
      )
    ).complete,
    true,
  );
  for (const extension of [".p", ".mlx", ".mexw64"])
    TestValidator.equals(
      `reject nontext source ${extension}`,
      (
        await adapter.analyze(
          EvidTestSourceSnapshot.create(
            `src/Dynamic${extension}`,
            "function Dynamic()\nend\n",
          ),
        )
      ).complete,
      false,
    );
  TestValidator.equals(
    "configured .m uses MATLAB",
    EvidLanguageRegistry.select("matlab", "Shared.m").id,
    "matlab",
  );
  const unavailable = EvidTestSourceSnapshot.create("src/missing.m", "");
  unavailable.complete = false;
  unavailable.diagnostics.push({
    code: "path-unreadable",
    path: "/project/src/missing.m",
    message: "Source is unavailable.",
  });
  TestValidator.equals(
    "source failure cannot pass",
    (await adapter.analyze(unavailable)).complete,
    false,
  );
}
