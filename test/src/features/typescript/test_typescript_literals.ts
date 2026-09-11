import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps literal member segments exact and gives anonymous default declarations one address. */
export async function test_typescript_literals(): Promise<void> {
  const snapshot = TestSourceSnapshot.combine([
    TestSourceSnapshot.create(
      "src/literals.ts",
      dedent`
        export interface Literal {
          "member.with.dots"(): void;
          "\\u0061.b": string;
          0: string;
          0x10: string;
          1e2: string;
          [computed]: string;
        }

        export class Secret {
          #private = 1;
          "public.name" = 2;
        }
      `,
    ),
    TestSourceSnapshot.create(
      "src/default-class.ts",
      "export default class { member = 1; }",
    ),
    TestSourceSnapshot.create(
      "src/default-function.ts",
      "export default function (): void {}",
    ),
  ]);
  const inventory = await new EvidenceTypeScriptAdapter().analyze(snapshot);

  TestValidator.equals(
    "literal member segments",
    inventory.addresses
      .filter((address) => address.file === "/project/src/literals.ts")
      .map((address) => address.segments)
      .sort(compareSegments),
    [
      ["Literal"],
      ["Literal", "0"],
      ["Literal", "100"],
      ["Literal", "16"],
      ["Literal", "a.b"],
      ["Literal", "member.with.dots"],
      ["Secret"],
      ["Secret", "prototype", "public.name"],
    ],
  );
  TestValidator.equals(
    "anonymous default class addresses",
    inventory.addresses
      .filter((address) => address.file === "/project/src/default-class.ts")
      .map((address) => address.segments.join("."))
      .sort(compare),
    ["default", "default.prototype.member"],
  );
  TestValidator.equals(
    "anonymous default function address",
    inventory.addresses
      .filter((address) => address.file === "/project/src/default-function.ts")
      .map((address) => address.segments.join(".")),
    ["default"],
  );
  TestValidator.equals("valid literal inventory", inventory.diagnostics, []);
}

function compareSegments(x: string[], y: string[]): number {
  for (let index = 0; index < Math.min(x.length, y.length); ++index) {
    const left = x[index] ?? "";
    const right = y[index] ?? "";
    if (left !== right) return left < right ? -1 : 1;
  }
  return x.length - y.length;
}

function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
