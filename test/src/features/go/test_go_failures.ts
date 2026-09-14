import { EvidenceGoAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps uncertain Go package surfaces incomplete.
 *
 * Missing ownership, package conflicts, conditional duplicates, and parse errors cannot shrink selected coverage.
 *
 * 1. Analyze each uncertain source form. 2. Require an incomplete inventory and diagnostic. 3. Retain no falsely complete population.
 */
export async function test_go_failures(): Promise<void> {
  const adapter = new EvidenceGoAdapter();

  // A selected exported method cannot disappear when its receiver source is absent.
  const missing = await adapter.analyze(
    TestSourceSnapshot.create(
      "shop/method.go",
      dedent`
        package shop

        func (Missing) Run() {}
      `,
    ),
  );
  TestValidator.equals("missing Go receiver", missing.complete, false);
  TestValidator.equals(
    "missing receiver diagnostic",
    hasCode(missing, "go-receiver"),
    true,
  );

  // Type aliases are public types but cannot establish local method ownership.
  const alias = await adapter.analyze(
    TestSourceSnapshot.create(
      "shop/alias.go",
      dedent`
        package shop

        type Alias = External
        func (Alias) Run() {}
      `,
    ),
  );
  TestValidator.equals("Go alias receiver", alias.complete, false);

  // A qualified receiver must not attach to a same-named local type.
  const qualified = await adapter.analyze(
    TestSourceSnapshot.create(
      "shop/qualified.go",
      dedent`
        package shop

        type Record struct{}
        func (remote.Record) Run() {}
      `,
    ),
  );
  TestValidator.equals("qualified Go receiver", qualified.complete, false);
  TestValidator.equals(
    "qualified receiver diagnostic",
    hasCode(qualified, "go-receiver"),
    true,
  );

  // The configured source set is literal: incompatible platform alternatives conflict.
  const conditional = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "shop/api_linux.go",
        dedent`
          //go:build linux

          package shop

          func Open() {}
        `,
      ),
      TestSourceSnapshot.create(
        "shop/api_windows.go",
        dedent`
          //go:build windows

          package shop

          func Open() {}
        `,
      ),
    ]),
  );
  TestValidator.equals("Go build-set conflict", conditional.complete, false);
  TestValidator.equals(
    "Go declaration conflict diagnostic",
    hasCode(conditional, "go-declaration-conflict"),
    true,
  );
  const open = conditional.units.find((unit) => unit.name === "Open");
  if (open === undefined) throw new Error("Missing conflicting Go function.");
  TestValidator.equals(
    "conflicting Go declaration sites",
    open.sites.length,
    2,
  );

  const packages = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("mixed/one.go", "package one\nfunc One() {}\n"),
      TestSourceSnapshot.create("mixed/two.go", "package two\nfunc Two() {}\n"),
    ]),
  );
  TestValidator.equals("incompatible Go packages", packages.complete, false);
  TestValidator.equals(
    "Go package boundary diagnostic",
    hasCode(packages, "go-package-boundary"),
    true,
  );

  // Tree-sitter syntax failures never become healthy empty inventories.
  const malformed = await adapter.analyze(
    TestSourceSnapshot.create(
      "shop/broken.go",
      "package shop\nfunc Broken( {\n",
    ),
  );
  TestValidator.equals("malformed Go source", malformed.complete, false);
  TestValidator.equals(
    "Go parse diagnostic",
    malformed.diagnostics.some(
      (diagnostic) => diagnostic.code === "go-parse-incomplete",
    ),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}
