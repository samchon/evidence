import { EvidencePythonAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Marks unsupported and unresolved Python public surfaces incomplete.
 *
 * These fixtures isolate dynamic **all** updates, failed exports, conditional
 * bindings, unsupported destructuring, import cycles, and parser recovery so an
 * uncertain inventory cannot shrink its obligations.
 *
 * 1. Analyze dynamic and unresolved export forms and verify their diagnostics
 *    while preserving ordinary public declarations.
 * 2. Analyze conditional module and instance bindings, including **all**
 *    exclusions and explicit private selection, and verify only selected
 *    unsupported surfaces fail.
 * 3. Analyze selected destructuring and a declaration-free cycle and verify their
 *    incomplete diagnostics.
 * 4. Analyze malformed source and verify parse failure is reported as incomplete.
 */
export async function test_python_failures(): Promise<void> {
  const adapter = new EvidencePythonAdapter();

  // Dynamic __all__ retains ordinary public declarations instead of erasing obligations.
  const dynamic = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/dynamic.py",
      dedent`
        public = 1
        __all__ = ["public"]
        __all__.append(runtime_name)
      `,
    ),
  );
  TestValidator.equals("dynamic __all__ incomplete", dynamic.complete, false);
  TestValidator.equals(
    "dynamic __all__ preserves declarations",
    dynamic.units.map((unit) => unit.name),
    ["public"],
  );
  TestValidator.equals(
    "dynamic __all__ diagnostic",
    hasCode(dynamic, "python-dynamic-all"),
    true,
  );

  // An explicit missing name and a missing local import both fail export analysis.
  const unresolved = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/unresolved.py",
      dedent`
        from .missing import Imported
        __all__ = ["Imported", "Absent"]
      `,
    ),
  );
  TestValidator.equals("unresolved Python exports", unresolved.complete, false);
  TestValidator.equals(
    "unresolved Python diagnostics",
    unresolved.diagnostics.filter(
      (diagnostic) => diagnostic.code === "python-export",
    ).length >= 2,
    true,
  );

  const emptyNamespace = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create("pkg/empty.py", "_private = 1\n"),
      EvidenceTestSourceSnapshot.create(
        "pkg/api.py",
        dedent`
          import pkg.empty as empty
          __all__ = ["empty"]
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "empty Python namespace export",
    emptyNamespace.complete,
    false,
  );

  // Conditional public bindings and instance fields are outside the static form matrix.
  const conditional = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/conditional.py",
      dedent`
        if enabled:
            def selected():
                return None
            conditional_value = 1

        class Record:
            def __init__(self):
                if enabled:
                    self.value = 1
      `,
    ),
  );
  TestValidator.equals(
    "conditional Python surface",
    conditional.complete,
    false,
  );
  TestValidator.equals(
    "conditional module diagnostic",
    hasCode(conditional, "python-dynamic-surface"),
    true,
  );
  TestValidator.equals(
    "conditional field diagnostic",
    hasCode(conditional, "python-dynamic-instance-field"),
    true,
  );

  const narrowed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/narrowed.py",
      dedent`
        __all__ = []

        if enabled:
            def excluded_by_all():
                return None
            from .missing import ExcludedImport
      `,
    ),
  );
  TestValidator.equals(
    "conditional declaration excluded by __all__",
    narrowed.complete,
    true,
  );

  // Explicit __all__ selection makes an underscored conditional binding public.
  const explicitPrivate = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/explicit-private.py",
      dedent`
        __all__ = ["_selected"]

        if enabled:
            _selected = 1
      `,
    ),
  );
  TestValidator.equals(
    "conditional explicit private export",
    explicitPrivate.complete,
    false,
  );
  TestValidator.equals(
    "conditional explicit private diagnostic",
    hasCode(explicitPrivate, "python-dynamic-surface"),
    true,
  );

  // Selected destructuring bindings remain visible as unsupported surface changes.
  const unsupportedBindings = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/unsupported-bindings.py",
      dedent`
        __all__ = ["_left", "Record"]

        _left, _right = (1, 2)

        class Record:
            def __init__(self):
                self.left, self.right = (1, 2)
      `,
    ),
  );
  TestValidator.equals(
    "unsupported selected binding forms",
    unsupportedBindings.complete,
    false,
  );
  TestValidator.equals(
    "selected binding diagnostics",
    unsupportedBindings.diagnostics.filter(
      (diagnostic) => diagnostic.code === "python-binding-pattern",
    ).length,
    2,
  );

  // A declaration-free import cycle terminates and reports the unresolved surface.
  const cycle = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "cycle/a.py",
        dedent`
          from .b import value
          __all__ = ["value"]
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "cycle/b.py",
        dedent`
          from .a import value
          __all__ = ["value"]
        `,
      ),
    ]),
  );
  TestValidator.equals("empty Python cycle", cycle.complete, false);
  TestValidator.equals(
    "finite cycle diagnostic",
    hasCode(cycle, "python-export"),
    true,
  );

  // Tree-sitter syntax failures never become healthy empty inventories.
  const malformed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/broken.py",
      "def broken(:\n    pass\n",
    ),
  );
  TestValidator.equals("malformed Python source", malformed.complete, false);
  TestValidator.equals(
    "Python parse diagnostic",
    hasCode(malformed, "python-parse-incomplete"),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}
