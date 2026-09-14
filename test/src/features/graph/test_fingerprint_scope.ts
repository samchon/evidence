import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/graph/EvidenceFingerprint";
import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Composes full structural scopes independently of selectors and withdrawal comments. */
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

async function markdownInventory(
  content: string,
  file: string = "docs/rules.md",
): Promise<IEvidenceInventory> {
  return new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(file, content),
  );
}

async function typescriptInventory(
  content: string,
): Promise<IEvidenceInventory> {
  return new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create("src/contracts.ts", content),
  );
}

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
