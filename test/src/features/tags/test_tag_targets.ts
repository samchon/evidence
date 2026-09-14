import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTagParser } from "../../../../packages/evidence/src/parsers/EvidenceTagParser";
import { TestDocumentation } from "../../internal/TestDocumentation";

/** Tokenizes the four requested code forms and preserves artifact-specific target spellings. */
export async function test_tag_targets(): Promise<void> {
  const fixture = TestDocumentation.create(dedent`
    /**
     * @evidence ../calculator.ts#add Checks arithmetic.
     * @evidence ../SomeClass.ts#SomeClass.member Checks the member.
     * @evidence ../SomeClass.ts#SomeClass Checks the class.
     * @evidence ../SomeNamespace.ts#SomeNamespace.property Checks the namespace.
     * @link ../some%20file.cpp#SomeClass["field name"] Checks the literal member.
     * @evidence docs/spec.md#pricing Follows the requirement.
     * @evidence prisma:Sale.price Follows the data definition.
     * @evidence POST:/sales Follows the operation.
     */
  `);
  const result = EvidenceTagParser.parse(
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
