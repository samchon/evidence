import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceMarkdownAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Fingerprints complete structural scopes, including identity rebinding and withdrawn descendants.
 *
 * A scope review concerns the actual declaration subtree, not only selected public
 * leaves. Own content, structural descendants, and withdrawal metadata must remain
 * distinguishable so annotation exclusion does not hide changes to reviewed API meaning.
 *
 * 1. Edit a nested Markdown section and require its parent's own content digest
 *    to stay stable while the parent scope fingerprint changes.
 * 2. Edit an unrelated sibling section and require the original scope to stay stable.
 * 3. Rebind identical Markdown content to another source path, then rebind one
 *    TypeScript public alias between identical declarations; require both identity
 *    changes to expire their respective fingerprints.
 * 4. Withdraw a TypeScript member through documentation and require unchanged parent
 *    own content but a changed parent scope fingerprint.
 * 5. Change the already withdrawn member's type and require the enclosing scope
 *    to change again, proving hidden descendants remain part of reviewed content.
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
  const pricingFingerprint = EvidenceFingerprint.inspect(original, pricing.id);

  // An unselected descendant still belongs to the cited scope.
  const changedChild = await markdownInventory(
    markdown.replace("One per issuer.", "Two per issuer."),
  );
  const changedPricing = EvidenceFingerprint.inspect(
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

  const changedSibling = await markdownInventory(
    markdown.replace("thirty days", "sixty days"),
  );

  TestValidator.equals(
    "unrelated section preserves scope",
    EvidenceFingerprint.inspect(
      changedSibling,
      requireUnit(changedSibling, "pricing").id,
    ).fingerprint,
    pricingFingerprint.fingerprint,
  );

  const rebound = await markdownInventory(markdown, "docs/rebound.md");

  TestValidator.equals(
    "rebinding identical content expires declaring identity",
    EvidenceFingerprint.inspect(rebound, requireUnit(rebound, "pricing").id)
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
  const publicContract = EvidenceFingerprint.inspect(
    publicInventory,
    requireUnit(publicInventory, "Contract").id,
  );
  const withdrawnContract = EvidenceFingerprint.inspect(
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
    EvidenceFingerprint.inspect(
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
): Promise<IEvidenceInventory> {
  return new EvidenceMarkdownAdapter().analyze(
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
): Promise<IEvidenceInventory> {
  return new EvidenceTypeScriptAdapter().analyze(
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
  const inventory = await new EvidenceTypeScriptAdapter().analyze(
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
  const resolution = new EvidenceInventory([inventory]).resolve(
    {
      file: "/project/src/index.ts",
      segments: ["Public"],
    },
    inventory.units.map((unit) => unit.id),
  );
  const unit = resolution.units[0];
  if (resolution.status !== "resolved" || unit === undefined)
    throw new Error("Missing re-exported fingerprint unit.");
  return EvidenceFingerprint.inspect(inventory, unit.id).fingerprint;
}

/**
 * Finds a fixture unit by declaration name or final explicit Markdown identity.
 *
 * Failure to extract the intended unit aborts setup rather than producing a
 * misleading fingerprint comparison against another candidate.
 */
function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === identity || candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing fingerprint unit: ${identity}`);
  return unit;
}
