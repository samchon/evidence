import {
  EvidenceLanguageRegistry,
  EvidenceObjcAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents unsupported preprocessing, Objective-C++, aliases, and C surfaces from becoming smaller successes. */
export async function test_objc_boundaries(): Promise<void> {
  const adapter = new EvidenceObjcAdapter();
  for (const content of [
    "#if FEATURE\n@interface Conditional\n@end\n#endif\n",
    "#define API(name) @interface name @end\n",
    "#ifndef FEATURE\n#define FEATURE\n@interface Conditional\n@end\n#endif\n@interface Outside\n@end\n",
    "#import HEADER\n@interface Contract\n@end\n",
    "@compatibility_alias Alias Contract;\n",
    "typedef int Number;\n",
    "extern int exported;\n",
    "function result = run(value)\nresult = value;\nend\n",
    "@interface Contract\n#if FEATURE\n@property int conditional;\n#endif\n@end\n",
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create("src/Unsupported.h", content),
    );
    TestValidator.equals(
      `surface is incomplete: ${content}`,
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      "actionable source failure",
      inventory.diagnostics.some(
        (item) => item.severity === "error" && item.repair.length !== 0,
      ),
    );
  }
  for (const file of ["src/Contract.m", "src/Contract.h"]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create(file, "@interface Contract\n@end\n"),
    );
    TestValidator.equals(
      `configured Objective-C source ${file}`,
      inventory.complete,
      true,
    );
    TestValidator.equals(
      "selected grammar wins overlapping extension",
      EvidenceLanguageRegistry.select("objc", file).id,
      "objc",
    );
  }
  const overlap = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.mm", "@interface Contract\n@end\n"),
  );
  TestValidator.equals(
    "Objective-C++ explicitly unsupported",
    overlap.diagnostics.map((item) => item.code),
    ["objc-unsupported-extension", "inventory-incomplete"],
  );

  const guards = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Guarded.h",
      dedent`
    #ifndef GUARDED_H
    #define GUARDED_H
    #import <Foundation/Foundation.h>
    @interface Guarded
    @end
    #endif
  `,
    ),
  );
  TestValidator.equals(
    "ordinary header guard preserves declaration",
    guards.diagnostics,
    [],
  );
  TestValidator.equals(
    "guard body is inventoried",
    guards.units.map((unit) => unit.name),
    ["Guarded"],
  );
  const conflicting = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/First.h", "@interface Conflict\n@end\n"),
      TestSourceSnapshot.create("src/Second.h", "@interface Conflict\n@end\n"),
    ]),
  );
  TestValidator.equals(
    "duplicate primary interfaces are incomplete",
    conflicting.diagnostics.map((item) => item.code),
    ["objc-declaration-conflict", "inventory-incomplete"],
  );

  const privacy = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/Public.h", "int run(void);\n"),
      TestSourceSnapshot.create(
        "src/Private.m",
        "static int run(void) { return 0; }\n@implementation Private\n- (void)hidden {}\n@end\n",
      ),
    ]),
  );
  TestValidator.equals(
    "static and implementation-only declarations stay unpublished",
    privacy.units.map((unit) => [unit.name, unit.sites.length]),
    [["run", 1]],
  );

  const failed = TestSourceSnapshot.create(
    "src/Failure.m",
    "@interface Contract\n@end\n",
  );
  failed.complete = false;
  failed.diagnostics.push({
    code: "path-unreadable",
    path: "/project/src/Failure.m",
    message: "Cannot read selected source.",
  });
  const failure = await adapter.analyze(failed);
  TestValidator.equals("source failure cannot pass", failure.complete, false);
  TestValidator.equals(
    "source diagnostic retained",
    failure.diagnostics.map((item) => item.code),
    ["source-path-unreadable", "inventory-incomplete"],
  );
}
