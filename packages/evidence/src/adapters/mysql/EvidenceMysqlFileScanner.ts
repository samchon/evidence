import type { Node as EvidenceNode } from "web-tree-sitter";

import { EvidenceMysqlDocumentation } from "./EvidenceMysqlDocumentation";
import { EvidenceMysqlPolicy } from "./EvidenceMysqlPolicy";
import type { IEvidenceSqlFileAnalysis } from "../sql/IEvidenceSqlFileAnalysis";
import { EvidenceSqlFileScanner } from "../sql/EvidenceSqlFileScanner";
import { EvidenceSourceText } from "../../internal/EvidenceSourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";

/**
 * Enriches shared SQL extraction with MySQL COMMENT hosts and dialect policy.
 *
 * This namespace supplies the scanner callback used by the MySQL adapter.
 */
export namespace EvidenceMysqlFileScanner {
  /**
   * Attaches only table and column COMMENT strings to their exact declaration
   * owner.
   *
   * Shared SQL scanning supplies declarations; this pass adds dialect-specific
   * documentation.
   */
  export function scan(
    session: EvidenceParseSession,
    source: IEvidenceSourceFile,
  ): IEvidenceSqlFileAnalysis {
    const analysis = new EvidenceSqlFileScanner(
      session,
      source,
      EvidenceMysqlPolicy,
    ).scan();
    const text = new EvidenceSourceText(source.content);
    for (const node of descendants(session.root)) {
      if (node.type !== "column_definition" && node.type !== "create_table")
        continue;
      const owner = analysis.declarations.find(
        (declaration) =>
          declaration.site.range.start.offset === node.startIndex,
      );
      if (owner === undefined) continue;
      const ranges =
        node.type === "column_definition"
          ? node.namedChildren
              .filter(
                (child) =>
                  child.type !== "comment" && child.type !== "marginalia",
              )
              .filter(
                (child, index, children) =>
                  child.type === "literal" &&
                  children[index - 1]?.type === "keyword_comment",
              )
              .map((literal) => session.range(literal))
          : node.namedChildren
              .filter(
                (child) =>
                  child.type === "table_option" &&
                  /^COMMENT\s*=/i.test(child.text),
              )
              .map((child) => {
                // The upstream grammar hides table-option string tokens; ownership comes from the complete option node.
                const offset = child.text.indexOf("=") + 1;
                const value = child.text.slice(offset);
                const whitespace = value.length - value.trimStart().length;
                return text.range(
                  child.startIndex + offset + whitespace,
                  child.endIndex,
                );
              });
      for (const range of ranges) {
        const id = `${source.id}:mysql-comment:${range.start.offset}`;
        const mapped = EvidenceMysqlDocumentation.read(source.content, range, id);
        if (mapped === undefined) {
          analysis.complete = false;
          analysis.diagnostics.push({
            code: "mysql-comment-mode",
            severity: "error",
            message:
              "The MySQL COMMENT literal requires an unsupported string or server escape mode.",
            repair:
              "Use a single-quoted COMMENT literal with doubled apostrophes and no backslash escapes.",
            location: { file: source.physicalPath, range },
          });
          continue;
        }
        analysis.documentation.push({
          id,
          range,
          mapped,
          attachments: [{ declarationId: owner.id, siteId: owner.site.id }],
        });
      }
    }
    return analysis;
  }
}

/**
 * Visits named syntax while keeping all attachment decisions local to
 * declarations.
 *
 * String contents remain opaque because they are not grammar nodes in the
 * traversal.
 */
function descendants(node: EvidenceNode): EvidenceNode[] {
  return [node, ...node.namedChildren.flatMap(descendants)];
}
