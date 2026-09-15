import {
  EvidLanguageRegistry,
  EvidObjcAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Rejects Objective-C inputs with unsupported public surfaces.
 *
 * Preprocessing, Objective-C++, aliases, C declarations, malformed syntax, and failed snapshots must not silently produce smaller inventories.
 *
 * 1. Analyze each unsupported or malformed source form.
 * 2. Require incomplete status and actionable diagnostics.
 * 3. Verify a source failure remains incomplete.
 */
export async function test_objc_boundaries(): Promise<void> {
  const adapter = new EvidObjcAdapter();
  TestValidator.equals(
    "configured types distinguish the shared MATLAB and Objective-C extension",
    [
      EvidLanguageRegistry.select("objc", "src/Shared.m").id,
      EvidLanguageRegistry.select("matlab", "src/Shared.m").id,
    ],
    ["objc", "matlab"],
  );
  for (const content of [
    "#if FEATURE\n@interface Conditional\n@end\n#endif\n",
    "#define API(name) @interface name @end\n",
    "#ifndef FEATURE\n#define FEATURE\n@interface Conditional\n@end\n#endif\n@interface Outside\n@end\n",
    "#import HEADER\n@interface Contract\n@end\n",
    "@compatibility_alias Alias Contract;\n",
    "typedef int Number;\n",
    "extern int exported;\n",
    "@interface Contract\n@property struct { int child; } value;\n@end\n",
    "struct { int child; } run(void);\n",
    "function result = run(value)\nresult = value;\nend\n",
    "@interface Contract\n#if FEATURE\n@property int conditional;\n#endif\n@end\n",
  ]) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create("src/Unsupported.h", content),
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
      EvidTestSourceSnapshot.create(file, "@interface Contract\n@end\n"),
    );
    TestValidator.equals(
      `configured Objective-C source ${file}`,
      inventory.complete,
      true,
    );
    TestValidator.equals(
      "selected grammar wins overlapping extension",
      EvidLanguageRegistry.select("objc", file).id,
      "objc",
    );
  }
  const overlap = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/Contract.mm", "@interface Contract\n@end\n"),
  );
  TestValidator.equals(
    "Objective-C++ explicitly unsupported",
    overlap.diagnostics.map((item) => item.code),
    ["inventory-incomplete", "objc-unsupported-extension"],
  );

  const guards = await adapter.analyze(
    EvidTestSourceSnapshot.create(
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
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create("src/First.h", "@interface Conflict\n@end\n"),
      EvidTestSourceSnapshot.create("src/Second.h", "@interface Conflict\n@end\n"),
    ]),
  );
  TestValidator.equals(
    "duplicate primary interfaces are incomplete",
    conflicting.diagnostics.map((item) => item.code),
    ["inventory-incomplete", "objc-declaration-conflict"],
  );

  const privacy = await adapter.analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create("src/Public.h", "int run(void);\n"),
      EvidTestSourceSnapshot.create(
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

  const failed = EvidTestSourceSnapshot.create(
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
    ["inventory-incomplete", "source-path-unreadable"],
  );
}
