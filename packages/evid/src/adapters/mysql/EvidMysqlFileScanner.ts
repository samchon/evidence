import type { Node as EvidNode } from "web-tree-sitter";

import { EvidMysqlDocumentation } from "./EvidMysqlDocumentation";
import { EvidMysqlPolicy } from "./EvidMysqlPolicy";
import type { IEvidSqlFileAnalysis } from "../sql/IEvidSqlFileAnalysis";
import { EvidSqlFileScanner } from "../sql/EvidSqlFileScanner";
import { EvidSourceText } from "../../internal/EvidSourceText";
import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";

/**
 * Enriches shared SQL extraction with MySQL COMMENT hosts and dialect policy.
 *
 * This namespace supplies the scanner callback used by the MySQL adapter.
 */
export namespace EvidMysqlFileScanner {
  /**
   * Attaches only table and column COMMENT strings to their exact declaration owner.
   *
   * Shared SQL scanning supplies declarations; this pass adds dialect-specific documentation.
   */
  export function scan(
    session: EvidParseSession,
    source: IEvidSourceFile,
  ): IEvidSqlFileAnalysis {
    const analysis = new EvidSqlFileScanner(session, source, EvidMysqlPolicy).scan();
    const text = new EvidSourceText(source.content);
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
        const mapped = EvidMysqlDocumentation.read(source.content, range, id);
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
 * Visits named syntax while keeping all attachment decisions local to declarations.
 *
 * String contents remain opaque because they are not grammar nodes in the traversal.
 */
function descendants(node: EvidNode): EvidNode[] {
  return [node, ...node.namedChildren.flatMap(descendants)];
}
