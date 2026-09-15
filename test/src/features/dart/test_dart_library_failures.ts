import { EvidenceDartAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects contradictory Dart library topology and ambiguous exports.
 *
 * Library ownership and exported names must be unambiguous, while local
 * shadowing and supported export cycles still have a defined static surface.
 *
 * 1. Analyze mismatched part declarations and exports with competing visible
 *    names.
 * 2. Require each contradictory topology or ambiguous export to be incomplete with
 *    its expected diagnostic.
 * 3. Verify local export shadowing and supported cycles remain analyzable.
 */
export async function test_dart_library_failures(): Promise<void> {
  const adapter = new EvidenceDartAdapter();
  for (const [sources, code] of new Map<string[], string>([
    [["part 'part.dart';", "class Wrong {}"], "dart-part-owner"],
    [
      ["class Owner {}", "part of 'api.dart'; class Orphan {}"],
      "dart-part-owner",
    ],
    [
      ["part 'part.dart';", "part of 'other.dart'; class Wrong {}"],
      "dart-part-owner",
    ],
    [
      [
        "export 'part.dart'; part 'part.dart';",
        "part of 'api.dart'; class Part {}",
      ],
      "dart-export-part",
    ],
    [
      [
        "part 'part.dart'; class Conflict {}",
        "part of 'api.dart'; class Conflict {}",
      ],
      "dart-declaration-conflict",
    ],
    [
      [
        "part 'part.dart';",
        "import 'external.dart'; part of 'api.dart'; class Part {}",
      ],
      "dart-part-directives",
    ],
  ])) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.combine(
        sources.map((content, index) =>
          EvidenceTestSourceSnapshot.create(
            index === 0 ? "src/api.dart" : "src/part.dart",
            content,
          ),
        ),
      ),
    );
    TestValidator.equals(
      "contradictory library graph is incomplete",
      inventory.complete,
      false,
    );
    TestValidator.predicate(
      `verified semantic boundary ${code}`,
      inventory.diagnostics.some((diagnostic) => diagnostic.code === code),
    );
  }
  for (const local of [false, true]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.combine([
        EvidenceTestSourceSnapshot.create(
          "src/api.dart",
          `export 'a.dart'; export 'b.dart'; ${local ? "class Shared {}" : ""}`,
        ),
        EvidenceTestSourceSnapshot.create(
          "src/a.dart",
          "export 'api.dart'; class Shared {}",
        ),
        EvidenceTestSourceSnapshot.create("src/b.dart", "class Shared {}"),
      ]),
    );
    TestValidator.equals(
      `local declaration shadows exports ${local}`,
      inventory.complete,
      local,
    );
    TestValidator.equals(
      `ambiguity diagnostic ${local}`,
      inventory.diagnostics.some(
        (diagnostic) => diagnostic.code === "dart-export-conflict",
      ),
      !local,
    );
  }
}
