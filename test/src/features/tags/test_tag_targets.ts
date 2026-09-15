import { EvidTagParser } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestDocumentation } from "../../internal/TestDocumentation";

/** Tokenizes source, Markdown, schema, and operation targets without changing their spelling.
 *
 * The common tag parser must preserve each target for its artifact-specific resolver,
 * including a quoted accessor segment whose following prose is the reason.
 *
 * 1. Parse TypeScript declaration and member paths, a C++ quoted-member path,
 *    Markdown, Prisma, and HTTP targets.
 * 2. Verify all eight target strings and the literal-member reason remain exact.
 * 3. Require every valid `@evid` and `@link` entry to be positive evidence
 *    with no diagnostics.
 */
export async function test_tag_targets(): Promise<void> {
  const fixture = TestDocumentation.create(dedent`
    /**
     * @evid ../calculator.ts#add Checks arithmetic.
     * @evid ../SomeClass.ts#SomeClass.member Checks the member.
     * @evid ../SomeClass.ts#SomeClass Checks the class.
     * @evid ../SomeNamespace.ts#SomeNamespace.property Checks the namespace.
     * @link ../some%20file.cpp#SomeClass["field name"] Checks the literal member.
     * @evid docs/spec.md#pricing Follows the requirement.
     * @evid prisma:Sale.price Follows the data definition.
     * @evid POST:/sales Follows the operation.
     */
  `);
  const result = EvidTagParser.parse(
    fixture.content,
    fixture.host,
    fixture.documentation,
  );

  TestValidator.equals(
    "all target forms",
    result.declarations.map((entry) => entry.target),
    [
      "../calculator.ts#add",
      "../SomeClass.ts#SomeClass.member",
      "../SomeClass.ts#SomeClass",
      "../SomeNamespace.ts#SomeNamespace.property",
      '../some%20file.cpp#SomeClass["field name"]',
      "docs/spec.md#pricing",
      "prisma:Sale.price",
      "POST:/sales",
    ],
  );
  TestValidator.equals(
    "quoted segment does not swallow its reason",
    result.declarations
      .filter((entry) => entry.target.startsWith("../some%20"))
      .map((entry) => entry.reason),
    ["Checks the literal member."],
  );
  TestValidator.predicate(
    "link remains positive evidence",
    result.declarations.every((entry) => entry.kind === "evidence"),
  );
  TestValidator.equals(
    "valid targets have no diagnostics",
    result.diagnostics,
    [],
  );
}
