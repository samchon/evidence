import {
  EvidFingerprint,
  EvidGraph,
  EvidInventory,
  EvidMarkdownAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import type {
  IEvidGraphReference,
  IEvidInventory,
  IEvidUnit,
  IEvidUnitSite,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";
import { TestGraph } from "../../internal/TestGraph";

/**
 * Fingerprints complete structural scopes, including identity rebinding and withdrawn descendants.
 *
 * A scope review concerns the actual declaration subtree, not only selected public
 * leaves. Own content, structural descendants, and withdrawal metadata must remain
 * distinguishable so annotation exclusion does not hide changes to reviewed API meaning.
 *
 * 1. Edit a nested Markdown section and require its parent's own content digest
 *    to stay stable while the parent scope fingerprint changes.
 * 2. Insert ordinary prose and accepted Evid metadata before the reviewed
 *    heading; require its fingerprint and exact shifted range to remain stable,
 *    then exercise `requireReview` against the shifted document.
 * 3. Edit prose after single- and multiline HTML comments; require the owning
 *    heading fingerprint to expire while annotation text remains excluded.
 * 4. Edit an unrelated sibling section and require the original scope to stay stable.
 * 5. Rebind identical Markdown content to another source path, then rebind one
 *    TypeScript public alias between identical declarations; require both identity
 *    changes to expire their respective fingerprints.
 * 6. Withdraw a TypeScript member through documentation and require unchanged parent
 *    own content but a changed parent scope fingerprint.
 * 7. Change the already withdrawn member's type and require the enclosing scope
 *    to change again, proving hidden descendants remain part of reviewed content.
 * 8. Edit only an HTML-comment annotation inside a generated-anchor heading and
 *    require its public identity and fingerprint to remain stable.
 */
export async function test_fingerprint_scope(): Promise<void> {
  const markdown = dedent`
    ## Pricing {#pricing}

    The rate is capped.

    ### Coupons {#coupons}

    One per issuer.

    ## Refunds {#refunds}

    Refunds close after thirty days.
  `;
  const original = await markdownInventory(markdown);
  const pricing = requireUnit(original, "pricing");
  const pricingFingerprint = EvidFingerprint.inspect(original, pricing.id);

  // An unselected descendant still belongs to the cited scope.
  const changedChild = await markdownInventory(
    markdown.replace("One per issuer.", "Two per issuer."),
  );
  const changedPricing = EvidFingerprint.inspect(
    changedChild,
    requireUnit(changedChild, "pricing").id,
  );

  TestValidator.equals(
    "child leaves parent own digest unchanged",
    changedPricing.contentDigest,
    pricingFingerprint.contentDigest,
  );
  TestValidator.equals(
    "child moves parent scope",
    changedPricing.fingerprint === pricingFingerprint.fingerprint,
    false,
  );

  // File-level material before a heading moves its site but not that heading's identity.
  const prefix: string = `${dedent`
    Unrelated file introduction.

    <!-- @evid other.md Explains the file aggregate. -->
  `}\n\n`;
  const prefixed: IEvidInventory = await markdownInventory(
    prefix + markdown,
  );
  const prefixedPricing: IEvidUnit = requireUnit(prefixed, "pricing");
  const prefixedSite: IEvidUnitSite | undefined = prefixedPricing.sites[0];
  if (prefixedSite === undefined)
    throw new Error("Shifted Markdown heading has no declaration site.");
  TestValidator.equals(
    "earlier prose and metadata preserve heading fingerprint",
    EvidFingerprint.inspect(prefixed, prefixedPricing.id).fingerprint,
    pricingFingerprint.fingerprint,
  );
  TestValidator.equals(
    "shifted heading retains exact source position",
    prefixedSite.range.start.offset,
    (prefix + markdown).indexOf("## Pricing"),
  );
  const reviewedClaim: IEvidInventory =
    await new EvidTypeScriptAdapter().analyze(
      TestSourceSnapshot.create(
        "src/review.ts",
        dedent`
          /**
           * @evid docs/rules.md#pricing Implements pricing.
           * @evidReview docs/rules.md#pricing #${pricingFingerprint.fingerprint} Rechecked the unchanged rule.
           */
          export function price(): number {
            return 1;
          }
        `,
      ),
    );
  const reviewedUnit: IEvidUnit = requireUnit(reviewedClaim, "price");
  const reviewedReference: IEvidGraphReference = {
    severity: "error",
    inventory: prefixed,
    unitIds: [prefixedPricing.id],
    resolutions: await TestGraph.resolveDeclarations(reviewedClaim, prefixed, [
      prefixedPricing.id,
    ]),
    reviewResolutions: await TestGraph.resolveReviews(reviewedClaim, prefixed, [
      prefixedPricing.id,
    ]),
    requireReview: true,
  };
  TestValidator.predicate(
    "shifted heading keeps required review current",
    EvidGraph.evaluate({
      claims: [
        {
          severity: "error",
          inventory: reviewedClaim,
          unitIds: [reviewedUnit.id],
          references: [reviewedReference],
        },
      ],
    }).success,
  );

  const commentSuffix: string = dedent`
    ## Pricing {#pricing}

    <!-- @evid other.md Explains the rule. --> First semantic suffix.
  `;
  const commentSuffixInventory: IEvidInventory =
    await markdownInventory(commentSuffix);
  const changedCommentSuffix: IEvidInventory = await markdownInventory(
    commentSuffix.replace("First semantic suffix.", "Second semantic suffix."),
  );
  TestValidator.notEquals(
    "prose after one-line comment expires fingerprint",
    EvidFingerprint.inspect(
      changedCommentSuffix,
      requireUnit(changedCommentSuffix, "pricing").id,
    ).fingerprint,
    EvidFingerprint.inspect(
      commentSuffixInventory,
      requireUnit(commentSuffixInventory, "pricing").id,
    ).fingerprint,
  );

  const multilineSuffix: string = dedent`
    ## Pricing {#pricing}

    <!--
    @evid other.md Explains the rule.
    --> First multiline suffix.
  `;
  const multilineSuffixInventory: IEvidInventory =
    await markdownInventory(multilineSuffix);
  const changedMultilineSuffix: IEvidInventory = await markdownInventory(
    multilineSuffix.replace(
      "First multiline suffix.",
      "Second multiline suffix.",
    ),
  );
  TestValidator.notEquals(
    "prose after multiline comment expires fingerprint",
    EvidFingerprint.inspect(
      changedMultilineSuffix,
      requireUnit(changedMultilineSuffix, "pricing").id,
    ).fingerprint,
    EvidFingerprint.inspect(
      multilineSuffixInventory,
      requireUnit(multilineSuffixInventory, "pricing").id,
    ).fingerprint,
  );

  const plainSection: IEvidInventory = await markdownInventory(dedent`
    ## Pricing {#pricing}
    Stable semantic prose.
  `);
  const annotatedSection: IEvidInventory = await markdownInventory(dedent`
    ## Pricing {#pricing}
    <!-- @evid other.md Explains the rule. -->
    Stable semantic prose.
  `);
  TestValidator.equals(
    "full annotation line preserves fingerprint",
    EvidFingerprint.inspect(
      annotatedSection,
      requireUnit(annotatedSection, "pricing").id,
    ).fingerprint,
    EvidFingerprint.inspect(
      plainSection,
      requireUnit(plainSection, "pricing").id,
    ).fingerprint,
  );

  const inlineHeadingComment: IEvidInventory = await markdownInventory(
    "# Rule <!-- @evid other.md First explanation. -->\n",
  );
  const changedInlineHeadingComment: IEvidInventory =
    await markdownInventory(
      "# Rule <!-- @evid other.md Second explanation. -->\n",
    );
  const inlineRule: IEvidUnit = requireUnit(inlineHeadingComment, "rule");
  const changedInlineRule: IEvidUnit = requireUnit(
    changedInlineHeadingComment,
    "rule",
  );
  TestValidator.equals(
    "inline heading annotation preserves generated identity",
    changedInlineRule.identity,
    inlineRule.identity,
  );
  TestValidator.equals(
    "inline heading annotation preserves fingerprint",
    EvidFingerprint.inspect(
      changedInlineHeadingComment,
      changedInlineRule.id,
    ).fingerprint,
    EvidFingerprint.inspect(inlineHeadingComment, inlineRule.id)
      .fingerprint,
  );

  const changedSibling = await markdownInventory(
    markdown.replace("thirty days", "sixty days"),
  );

  TestValidator.equals(
    "unrelated section preserves scope",
    EvidFingerprint.inspect(
      changedSibling,
      requireUnit(changedSibling, "pricing").id,
    ).fingerprint,
    pricingFingerprint.fingerprint,
  );

  const rebound = await markdownInventory(markdown, "docs/rebound.md");

  TestValidator.equals(
    "rebinding identical content expires declaring identity",
    EvidFingerprint.inspect(rebound, requireUnit(rebound, "pricing").id)
      .fingerprint === pricingFingerprint.fingerprint,
    false,
  );

  const firstAlias = await reexportedFingerprint("./first");
  const secondAlias = await reexportedFingerprint("./second");

  TestValidator.equals(
    "rebinding one public alias expires declaring identity",
    firstAlias === secondAlias,
    false,
  );

  // Withdrawal metadata moves the scope even though its JSDoc is excluded from content.
  const publicTypeScript = dedent`
    export interface Contract {
      price: number;
      /** Public audit field. */
      audit: string;
    }
  `;
  const withdrawnTypeScript = dedent`
    export interface Contract {
      price: number;
      /** @internal */
      audit: string;
    }
  `;
  const publicInventory = await typescriptInventory(publicTypeScript);
  const withdrawnInventory = await typescriptInventory(withdrawnTypeScript);
  const publicContract = EvidFingerprint.inspect(
    publicInventory,
    requireUnit(publicInventory, "Contract").id,
  );
  const withdrawnContract = EvidFingerprint.inspect(
    withdrawnInventory,
    requireUnit(withdrawnInventory, "Contract").id,
  );

  TestValidator.equals(
    "withdrawal annotation leaves own content unchanged",
    withdrawnContract.contentDigest,
    publicContract.contentDigest,
  );
  TestValidator.equals(
    "withdrawal metadata expires scope",
    withdrawnContract.fingerprint === publicContract.fingerprint,
    false,
  );

  const changedWithdrawnInventory = await typescriptInventory(
    withdrawnTypeScript.replace("audit: string", "audit: bigint"),
  );

  TestValidator.equals(
    "withdrawn descendant content still expires enclosing scope",
    EvidFingerprint.inspect(
      changedWithdrawnInventory,
      requireUnit(changedWithdrawnInventory, "Contract").id,
    ).fingerprint === withdrawnContract.fingerprint,
    false,
  );
}

/**
 * Extracts a Markdown variant with an optionally changed source identity.
 *
 * Most calls preserve the default path; the rebinding scenario supplies another
 * path to distinguish identity changes from prose changes.
 */
async function markdownInventory(
  content: string,
  file: string = "docs/rules.md",
): Promise<IEvidInventory> {
  return new EvidMarkdownAdapter().analyze(
    TestSourceSnapshot.create(file, content),
  );
}

/**
 * Extracts public and withdrawn TypeScript variants at one stable source path.
 *
 * Shared source identity keeps withdrawal and member-content changes isolated
 * from unrelated rebinding effects.
 */
async function typescriptInventory(
  content: string,
): Promise<IEvidInventory> {
  return new EvidTypeScriptAdapter().analyze(
    TestSourceSnapshot.create("src/contracts.ts", content),
  );
}

/**
 * Resolves one public alias after choosing which identical declaration it forwards.
 *
 * The barrel address stays constant while its target module changes. Fingerprinting
 * the resolved declaration tests whether semantic rebinding expires the review.
 */
async function reexportedFingerprint(module: string): Promise<string> {
  const inventory = await new EvidTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/first.ts",
        "export interface Contract { value: string; }",
      ),
      TestSourceSnapshot.create(
        "src/second.ts",
        "export interface Contract { value: string; }",
      ),
      TestSourceSnapshot.create(
        "src/index.ts",
        `export { Contract as Public } from "${module}";`,
      ),
    ]),
  );
  const resolution = new EvidInventory([inventory]).resolve(
    {
      file: "/project/src/index.ts",
      segments: ["Public"],
    },
    inventory.units.map((unit) => unit.id),
  );
  const unit = resolution.units[0];
  if (resolution.status !== "resolved" || unit === undefined)
    throw new Error("Missing re-exported fingerprint unit.");
  return EvidFingerprint.inspect(inventory, unit.id).fingerprint;
}

/**
 * Finds a fixture unit by declaration name or final explicit Markdown identity.
 *
 * Failure to extract the intended unit aborts setup rather than producing a
 * misleading fingerprint comparison against another candidate.
 */
function requireUnit(
  inventory: IEvidInventory,
  identity: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === identity || candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing fingerprint unit: ${identity}`);
  return unit;
}
