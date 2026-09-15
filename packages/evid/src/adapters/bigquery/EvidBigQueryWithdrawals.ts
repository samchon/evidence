import { EvidTagParser } from "../../parsers/EvidTagParser";
import { EvidSqlDocumentation } from "../sql/EvidSqlDocumentation";
import type { IEvidSqlFileAnalysis } from "../sql/IEvidSqlFileAnalysis";

/**
 * Propagates STRUCT withdrawals while keeping each field owned by its table model.
 *
 * Nested fields inherit only parsed withdrawal annotations from their enclosing schema field.
 */
export namespace EvidBigQueryWithdrawals {
  /**
   * Copies parsed withdrawal annotations to explicitly nested schema fields.
   *
   * This runs after documentation attachment so ordinary annotations remain at their own sites.
   */
  export function apply(analysis: IEvidSqlFileAnalysis): void {
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
        const mapped = EvidSqlDocumentation.read(
          analysis.source,
          documentation,
          documentation.id,
        );
        const parsed = EvidTagParser.parse(
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
