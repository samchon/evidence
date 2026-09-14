import { EvidenceDartAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Rejects contradictory part relationships and ambiguous exports while allowing local export shadowing and cycles. */
export async function test_dart_library_failures(): Promise<void> {
  const adapter = new EvidenceDartAdapter();
  for (const sources of [
    ["part 'part.dart';", "class Wrong {}"],
    ["class Owner {}", "part of 'api.dart'; class Orphan {}"],
    ["part 'part.dart';", "part of 'other.dart'; class Wrong {}"],
    [
      "part 'part.dart'; export 'part.dart';",
      "part of 'api.dart'; class Part {}",
    ],
    [
      "part 'part.dart'; class Conflict {}",
      "part of 'api.dart'; class Conflict {}",
    ],
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.combine(
        sources.map((content, index) =>
          TestSourceSnapshot.create(
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
  }
  for (const local of [false, true]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.combine([
        TestSourceSnapshot.create(
          "src/api.dart",
          `export 'a.dart'; export 'b.dart'; ${local ? "class Shared {}" : ""}`,
        ),
        TestSourceSnapshot.create(
          "src/a.dart",
          "export 'api.dart'; class Shared {}",
        ),
        TestSourceSnapshot.create("src/b.dart", "class Shared {}"),
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
