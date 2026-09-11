import type { IEvidenceConfig } from "../structures/IEvidenceConfig";
import type { IEvidenceReference } from "../structures/IEvidenceReference";

/** Rejects policy combinations whose obligations cannot be satisfied together. */
export function validateEvidenceConfig(config: IEvidenceConfig): void {
  const problems: string[] = [];
  config.claims.forEach((claim, claimIndex) => {
    const references: IEvidenceReference[] = Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];
    references.forEach((reference, referenceIndex) => {
      const base = Array.isArray(claim.reference)
        ? `claims[${claimIndex}].reference[${referenceIndex}]`
        : `claims[${claimIndex}].reference`;
      if (reference.type !== "markdown" && "checklist" in reference)
        problems.push(
          `${base}.checklist: only a Markdown reference can be a checklist; a ${reference.type} population has no Markdown reading hierarchy.`,
        );
      if (reference.type !== "markdown" || reference.checklist !== true) return;
      if (reference.uniqueEvidence === true)
        problems.push(
          `${base}: checklist and uniqueEvidence cannot both hold; a checklist requires every host to answer every item while uniqueEvidence permits at most one host per item.`,
        );
      if (reference.singleEvidencePerSymbol === true)
        problems.push(
          `${base}: checklist and singleEvidencePerSymbol cannot both hold; a checklist requires every item while singleEvidencePerSymbol requires exactly one item per host.`,
        );
      if (
        (claim.evidenceExcludeCarriers?.length ?? 0) !== 0 &&
        reference.noEvidenceExclude !== true
      )
        problems.push(
          `claims[${claimIndex}].evidenceExcludeCarriers: ${base} makes every acknowledgement one host's own answer, so it cannot gather checklist exclusions into shared carriers. Drop the carriers, drop checklist, or set noEvidenceExclude on that reference.`,
        );
    });
  });
  if (problems.length !== 0)
    throw new Error(
      [
        "Invalid Evidence configuration:",
        ...problems.map((item) => `- ${item}`),
      ].join("\n"),
    );
}
