import { EvidenceGoAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps ordinary, same-package test, and external test-package identities separate. */
export async function test_go_packages(): Promise<void> {
  const inventory = await new EvidenceGoAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "shop/api.go",
        dedent`
          package shop

          type Record struct{}
          func Shared() {}
        `,
      ),
      TestSourceSnapshot.create(
        "shop/api_test.go",
        dedent`
          package shop

          func TestHelper() {}
          func (Record) Verify() {}
        `,
      ),
      TestSourceSnapshot.create(
        "shop/external_test.go",
        dedent`
          package shop_test

          func Shared() {}
        `,
      ),
    ]),
  );

  TestValidator.equals(
    "Go selected test source units",
    inventory.units.map((unit) => unit.identity.join(".")).sort(compare),
    ["Record", "Record.Verify", "Shared", "Shared", "TestHelper"].sort(compare),
  );
  TestValidator.equals(
    "separate Go package identities",
    new Set(
      inventory.units
        .filter((unit) => unit.identity.join(".") === "Shared")
        .map((unit) => unit.id),
    ).size,
    2,
  );
  TestValidator.equals(
    "complete Go package selection",
    inventory.diagnostics,
    [],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
