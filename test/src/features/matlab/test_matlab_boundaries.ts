import {
  EvidenceLanguageRegistry,
  EvidenceMatlabAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves actionable incompleteness for runtime surfaces, malformed source, and unavailable files. */
export async function test_matlab_boundaries(): Promise<void> {
  const adapter = new EvidenceMatlabAdapter();
  for (const content of [
    "classdef Dynamic < dynamicprops\nend\n",
    "function Dynamic()\naddpath('other');\nend\n",
    "function Dynamic()\neval('classdef X');\nend\n",
    "function Dynamic()\nobj=class(struct(),'Legacy');\nend\n",
    "classdef Dynamic\nproperties (Unknown=true)\nvalue\nend\nend\n",
    "classdef Dynamic\nmethods\nfunction value=get.missing(obj)\nvalue=1;\nend\nend\nend\n",
    "classdef Dynamic\nproperties\nvalue\n",
    "value = 1;\n",
    "@interface Dynamic\n@end\n",
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create("src/Dynamic.m", content),
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
  for (const extension of [".p", ".mlx", ".mexw64"])
    TestValidator.equals(
      `reject nontext source ${extension}`,
      (
        await adapter.analyze(
          TestSourceSnapshot.create(
            `src/Dynamic${extension}`,
            "function Dynamic()\nend\n",
          ),
        )
      ).complete,
      false,
    );
  TestValidator.equals(
    "configured .m uses MATLAB",
    EvidenceLanguageRegistry.select("matlab", "Shared.m").id,
    "matlab",
  );
  const unavailable = TestSourceSnapshot.create("src/missing.m", "");
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
