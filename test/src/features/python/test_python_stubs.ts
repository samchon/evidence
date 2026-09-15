import { EvidencePythonAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Extracts public Python units from stubs and explicit private exports.
 *
 * The stub fixture combines aliases, overloads, Unicode identifiers,
 * properties, nested declarations, and **all** selection to verify source
 * spelling and public ownership.
 *
 * 1. Analyze the .pyi and Unicode Python source snapshots together.
 * 2. Verify the expected unit identities, symbol kinds, overload sites, and
 *    Unicode target spelling.
 * 3. Verify explicitly exported private declarations remain selectable while
 *    unselected private declarations stay hidden.
 */
export async function test_python_stubs(): Promise<void> {
  const inventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "types/contracts.pyi",
        dedent`
          from typing import TypeAlias

          __all__ = ("UserId", "transform", "Service")

          UserId: TypeAlias = str

          @overload
          def transform(value: int) -> int: ...

          @overload
          def transform(value: str) -> str: ...

          class Service:
              value: int
              def run(self) -> None: ...
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "unicode/contract.py",
        dedent`
          __all__ = ["판매", "_강제"]

          class 판매:
              값: int

              def 계산(self):
                  return self.값

          _강제 = 1
          _숨김 = 2
        `,
      ),
    ]),
  );

  TestValidator.equals(
    "Python stub addresses",
    addresses(inventory, "/project/types/contracts.pyi"),
    [
      "Service",
      "Service.prototype.run",
      "Service.value",
      "UserId",
      "transform",
    ],
  );
  const overload = inventory.units.find((unit) => unit.name === "transform");
  if (overload === undefined) throw new Error("Missing Python overload unit.");
  TestValidator.equals("Python overload sites", overload.sites.length, 2);

  TestValidator.equals(
    "Unicode and explicit private addresses",
    addresses(inventory, "/project/unicode/contract.py"),
    ["_강제", "판매", "판매.prototype.계산", "판매.값"],
  );
  TestValidator.equals("complete Python stubs", inventory.diagnostics, []);
}

function addresses(inventory: IEvidenceInventory, file: string): string[] {
  return inventory.addresses
    .filter((address) => address.file === file)
    .map((address) => address.segments.join("."))
    .sort(compare);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
