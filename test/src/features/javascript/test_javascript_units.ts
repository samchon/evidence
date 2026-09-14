import { EvidenceJavaScriptAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Classifies JavaScript declarations, public members, and literal names.
 *
 * The public denominator preserves member ownership and literal accessor segments.
 *
 * 1. Analyze exported declarations and members. 2. Compare identities and symbols. 3. Verify literal names stay one segment.
 */
export async function test_javascript_units(): Promise<void> {
  const inventory = await new EvidenceJavaScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.mjs",
      dedent`
        export class Service {
          static execute() {}
          execute() {}
          static handler = () => {};
          handler = () => {};
          value = 1;
          "literal.name"() {}
          #secret = 2;
          get ignored() { return this.value; }
          constructor() {}
        }

        export async function request() {}
        export function* sequence() { yield 1; }
        export const arrow = async () => {}, data = 1;
        export let mutable = () => {};

        export default class {
          member = 1;
        }
      `,
    ),
  );

  TestValidator.equals(
    "JavaScript declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Service.execute",
      "function:Service.handler",
      "function:Service.prototype.execute",
      "function:Service.prototype.handler",
      "function:Service.prototype.literal.name",
      "function:arrow",
      "function:request",
      "function:sequence",
      "property:Service.prototype.value",
      "property:data",
      "property:default.prototype.member",
      "property:mutable",
      "type:Service",
      "type:default",
    ].sort(compare),
  );

  // Static and instance members with the same spelling retain separate identities.
  const execute = inventory.units.filter(
    (unit) => unit.identity.at(-1) === "execute",
  );
  TestValidator.equals("distinct execute identities", execute.length, 2);
  TestValidator.equals(
    "excluded JavaScript members",
    inventory.units.some((unit) =>
      ["constructor", "ignored", "secret"].includes(unit.name),
    ),
    false,
  );
  TestValidator.equals(
    "complete JavaScript inventory",
    inventory.diagnostics,
    [],
  );

  const defaults = await new EvidenceJavaScriptAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/default-arrow.mjs",
        "export default async () => 1;",
      ),
      TestSourceSnapshot.create(
        "src/default-value.mjs",
        "export default { enabled: true };",
      ),
    ]),
  );
  TestValidator.equals(
    "anonymous default expressions",
    defaults.units.map((unit) => `${unit.symbol}:${unit.name}`).sort(compare),
    ["function:default", "property:default"],
  );
  TestValidator.equals(
    "complete default expressions",
    defaults.diagnostics,
    [],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
