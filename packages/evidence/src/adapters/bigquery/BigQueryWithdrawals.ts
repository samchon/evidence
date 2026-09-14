import { EvidenceTagParser } from "../../parsers/EvidenceTagParser";
import { SqlDocumentation } from "../sql/SqlDocumentation";
import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";

/** Propagates STRUCT withdrawals while keeping each field owned by its table model. */
export namespace BigQueryWithdrawals {
  /** Copies only parsed withdrawal annotations to explicitly nested schema fields. */
  export function apply(analysis: ISqlFileAnalysis): void {
    const declarations = new Map(
      analysis.declarations.map((declaration) => [declaration.id, declaration]),
    );
    for (const documentation of [...analysis.documentation]) {
      for (const attachment of documentation.attachments) {
        const owner = declarations.get(attachment.declarationId);
        if (owner === undefined || owner.symbol !== "column") continue;
        const descendants = analysis.declarations.filter(
          (declaration) =>
            declaration.symbol === "column" &&
            declaration.ownerDeclarationId === owner.ownerDeclarationId &&
            declaration.identity.length > owner.identity.length &&
            owner.identity.every(
              (segment, index) => declaration.identity[index] === segment,
            ),
        );
        if (descendants.length === 0) continue;
        const mapped = SqlDocumentation.read(
          analysis.source,
          documentation,
          documentation.id,
        );
        const parsed = EvidenceTagParser.parse(
          analysis.source.content,
          {
            id: documentation.id,
            file: analysis.source.physicalPath,
            range: documentation.range,
            siteId: owner.site.id,
            unitIds: [owner.id],
            attachment: "attached",
          },
          mapped,
        );
        if (parsed.withdrawals.length === 0) continue;
        const ranges = parsed.withdrawals.flatMap((withdrawal) =>
          withdrawal.location.range === undefined
            ? []
            : [withdrawal.location.range],
        );
        const text = mapped.text
          .split("")
          .map((character, index) => {
            const offset = mapped.offsets[index];
            return character === "\r" ||
              character === "\n" ||
              (offset !== undefined &&
                ranges.some(
                  (range) =>
                    offset >= range.start.offset && offset < range.end.offset,
                ))
              ? character
              : " ";
          })
          .join("");
        analysis.documentation.push({
          id: `${documentation.id}:nested-withdrawal`,
          range: documentation.range,
          mapped: { ...mapped, text },
          attachments: descendants.map((declaration) => ({
            declarationId: declaration.id,
            siteId: declaration.site.id,
          })),
        });
      }
    }
  }
}
