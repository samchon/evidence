import {
  EvidenceBigQueryAdapter,
  EvidenceChecker,
  EvidenceDocumentationExamples,
  EvidenceMysqlAdapter,
  EvidencePostgresqlAdapter,
  EvidenceSqlAdapter,
  EvidenceSqliteAdapter,
} from "evidence";
import type {
  IEvidenceAdapter,
  IEvidenceCheckReport,
  IEvidenceDeclaration,
  IEvidenceInventory,
  IEvidenceUnit,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";
import type { IEvidenceAdapterCertification } from "../../internal/certification/IEvidenceAdapterCertification";
import type { IEvidenceAdapterCertificationSource } from "../../internal/certification/IEvidenceAdapterCertificationSource";
import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Programming adapters whose documentation recognizes HTML example elements.
 *
 * Certification applies rendered, slash-closed, unclosed, malformed, and
 * comment-boundary mutations only where the reader owns this syntax.
 */
const HTML_DOCUMENTATION_TYPES: ReadonlySet<string> = new Set<string>([
  "java",
  "kotlin",
  "objc",
  "lua",
  "dart",
  "zig",
  "scala",
  "matlab",
  "swift",
  "php",
  "csharp",
  "c",
  "cpp",
]);

/**
 * Documentation readers with native code syntax preceding shared HTML masking.
 *
 * Their fixtures prove that literal HTML inside a native example cannot pair
 * with a later real element or annotation.
 */
const NATIVE_DOCUMENTATION_TYPES: ReadonlySet<string> = new Set<string>([
  "c",
  "cpp",
  "java",
  "scala",
]);

/**
 * Preserves real annotations across Markdown and HTML example precedence.
 *
 * Documentation readers must classify fenced and inline code before pairing
 * HTML examples. Pairing tag-shaped literals across two fences can otherwise
 * erase the real annotation and still publish a complete inventory.
 *
 * 1. Inject separate fenced `<pre>` and `</pre>` literals around the first real
 *    evidence statement in every programming certification fixture, together
 *    with inline literals and a fenced fake statement.
 * 2. Require all 19 programming inventories to retain their exact certified units,
 *    hosts, declarations, source ranges, and completeness.
 * 3. For the 13 programming adapters that support example-element masking, insert
 *    fake statements inside ordinary `pre` regions. For the 12 HTML readers,
 *    repeat the check with slash-closed non-void openings.
 * 4. Leave an HTML example open after the real statement and require every
 *    rendered statement through the host end to remain inert.
 * 5. Put indented HTML openings and closes around real or rendered statements;
 *    require those literal tokens not to change HTML pairing.
 * 6. Put attributes on a closing HTML tag and require that malformed token not to
 *    end the example before its exact close.
 * 7. Put an indented literal fence before a closed HTML region and require it not
 *    to consume the real statement that follows the HTML close.
 * 8. Exercise a tab-indented HTML token and a nested example whose outer close
 *    implicitly closes its inner element directly against the shared helper.
 * 9. Apply the same separated-fence and HTML-boundary checks to SQL, PostgreSQL,
 *    MySQL, SQLite, and BigQuery adapters and compare their complete
 *    inventories with an unmodified baseline.
 * 10. Run the combined PHP reproductions through EvidenceChecker and require the real
 *     statement after the HTML close to cover its requirement with exit zero.
 * 11. Replace that PHP host with only an acknowledgement inside an unclosed HTML
 *     example and require the checker to report the requirement as uncovered.
 * 12. Put fake annotations in HTML comments across all programming adapters, keep
 *     comment-looking quoted attributes and commented example tags from
 *     changing real evidence, and prove an unclosed comment cannot cover PHP.
 * 13. Preserve a true C# XML self-closing example before a real statement.
 * 14. Put literal HTML boundaries in Doxygen, Javadoc, and Scaladoc native code
 *     regions; require those regions to take precedence, and require unclosed
 *     Doxygen code to keep following fake annotations inert through the host
 *     end.
 * 15. Put native opening and closing delimiters in separate Markdown fences;
 *     require those literals not to span across the real Evidence statement.
 */
export async function test_adapter_documentation_precedence(): Promise<void> {
  for (const certification of EvidenceAdapterCertificationFixtures.all()) {
    const fenced: IEvidenceAdapterCertification = mutateCertification(
      certification,
      separatedFences,
    );
    const fencedInventory: IEvidenceInventory =
      await EvidenceAdapterCertification.analyze(fenced);
    EvidenceAdapterCertification.assertInventory(fenced, fencedInventory);

    for (const mutation of [
      htmlCommentedEvid,
      fencedHtmlCommentLiteral,
      quotedHtmlCommentLiteral,
    ]) {
      const commented: IEvidenceAdapterCertification = mutateCertification(
        certification,
        mutation,
      );
      const commentedInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(commented);
      EvidenceAdapterCertification.assertInventory(commented, commentedInventory);
    }

    if (HTML_DOCUMENTATION_TYPES.has(certification.type)) {
      const rendered: IEvidenceAdapterCertification = mutateCertification(
        certification,
        genuineHtmlExample,
      );
      const renderedInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(rendered);
      EvidenceAdapterCertification.assertInventory(rendered, renderedInventory);

      if (certification.type !== "csharp") {
        const slashClosed: IEvidenceAdapterCertification = mutateCertification(
          certification,
          slashClosedHtmlOpening,
        );
        const slashClosedInventory: IEvidenceInventory =
          await EvidenceAdapterCertification.analyze(slashClosed);
        EvidenceAdapterCertification.assertInventory(
          slashClosed,
          slashClosedInventory,
        );
      }

      const unclosed: IEvidenceAdapterCertification = mutateCertification(
        certification,
        unclosedHtmlExample,
      );
      const unclosedInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(unclosed);
      EvidenceAdapterCertification.assertInventory(unclosed, unclosedInventory);

      for (const mutation of [indentedHtmlOpening, indentedHtmlClose]) {
        const indentedHtml: IEvidenceAdapterCertification = mutateCertification(
          certification,
          mutation,
        );
        const indentedHtmlInventory: IEvidenceInventory =
          await EvidenceAdapterCertification.analyze(indentedHtml);
        EvidenceAdapterCertification.assertInventory(
          indentedHtml,
          indentedHtmlInventory,
        );
      }

      const malformedClose: IEvidenceAdapterCertification = mutateCertification(
        certification,
        malformedHtmlClose,
      );
      const malformedCloseInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(malformedClose);
      EvidenceAdapterCertification.assertInventory(
        malformedClose,
        malformedCloseInventory,
      );

      const indented: IEvidenceAdapterCertification = mutateCertification(
        certification,
        indentedFenceBeforeHtml,
      );
      const indentedInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(indented);
      EvidenceAdapterCertification.assertInventory(indented, indentedInventory);

      const commentedTags: IEvidenceAdapterCertification = mutateCertification(
        certification,
        commentedHtmlTags,
      );
      const commentedTagsInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(commentedTags);
      EvidenceAdapterCertification.assertInventory(
        commentedTags,
        commentedTagsInventory,
      );
    }

    if (certification.type === "csharp") {
      const xmlSelfClosing: IEvidenceAdapterCertification = mutateCertification(
        certification,
        xmlSelfClosingExample,
      );
      const xmlSelfClosingInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(xmlSelfClosing);
      EvidenceAdapterCertification.assertInventory(
        xmlSelfClosing,
        xmlSelfClosingInventory,
      );
    }

    if (NATIVE_DOCUMENTATION_TYPES.has(certification.type)) {
      const native: IEvidenceAdapterCertification = mutateCertification(
        certification,
        (content: string): string =>
          nativeCodePrecedence(certification.type, content),
      );
      const nativeInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(native);
      EvidenceAdapterCertification.assertInventory(native, nativeInventory);

      const markdownNative: IEvidenceAdapterCertification = mutateCertification(
        certification,
        (content: string): string =>
          markdownNativeLiteral(certification.type, content),
      );
      const markdownNativeInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(markdownNative);
      EvidenceAdapterCertification.assertInventory(
        markdownNative,
        markdownNativeInventory,
      );
    }

    if (certification.type === "c" || certification.type === "cpp") {
      const unclosedNative: IEvidenceAdapterCertification = mutateCertification(
        certification,
        unclosedDoxygenCode,
      );
      const unclosedNativeInventory: IEvidenceInventory =
        await EvidenceAdapterCertification.analyze(unclosedNative);
      EvidenceAdapterCertification.assertInventory(
        unclosedNative,
        unclosedNativeInventory,
      );
    }
  }

  const tabIndented: string = [
    "\t<pre>",
    "@evidence rules.md#rule Real statement.",
    "</pre>",
  ].join("\n");
  const tabCharacters: string[] = tabIndented.split("");
  EvidenceDocumentationExamples.maskHtml(tabCharacters, tabIndented, ["pre"]);
  TestValidator.predicate(
    "tab-indented HTML token stays literal",
    tabCharacters.join("").includes("@evidence rules.md#rule"),
  );

  const nested: string = [
    "<pre>",
    "<code>",
    "@evidence rules.md#rendered Fake nested statement.",
    "</pre>",
    "@evidence rules.md#rule Real statement.",
  ].join("\n");
  const nestedCharacters: string[] = nested.split("");
  EvidenceDocumentationExamples.maskHtml(nestedCharacters, nested, ["pre", "code"]);
  TestValidator.predicate(
    "outer HTML close ends nested example",
    !nestedCharacters.join("").includes("@evidence rules.md#rendered") &&
      nestedCharacters.join("").includes("@evidence rules.md#rule"),
  );

  const databaseAdapters: IEvidenceAdapter[] = [
    new EvidenceSqlAdapter(),
    new EvidencePostgresqlAdapter(),
    new EvidenceMysqlAdapter(),
    new EvidenceSqliteAdapter(),
    new EvidenceBigQueryAdapter(),
  ];
  for (const adapter of databaseAdapters) {
    const source: string = databaseSource(adapter.type);
    const baseline: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", source),
    );
    const fenced: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", separatedFences(source)),
    );
    const rendered: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", genuineHtmlExample(source)),
    );
    const slashClosed: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "schema.sql",
        slashClosedHtmlOpening(source),
      ),
    );
    const unclosed: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", unclosedHtmlExample(source)),
    );
    const indentedOpening: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", indentedHtmlOpening(source)),
    );
    const indentedClose: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", indentedHtmlClose(source)),
    );
    const indented: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "schema.sql",
        indentedFenceBeforeHtml(source),
      ),
    );
    const malformedClose: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", malformedHtmlClose(source)),
    );
    const commented: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", htmlCommentedEvid(source)),
    );
    const commentedTags: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("schema.sql", commentedHtmlTags(source)),
    );
    const quotedComment: IEvidenceInventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "schema.sql",
        quotedHtmlCommentLiteral(source),
      ),
    );
    assertEquivalent(`${adapter.type} fenced examples`, baseline, fenced);
    assertEquivalent(`${adapter.type} HTML example`, baseline, rendered);
    assertEquivalent(
      `${adapter.type} slash-closed HTML opening`,
      baseline,
      slashClosed,
    );
    assertEquivalent(
      `${adapter.type} unclosed HTML example`,
      baseline,
      unclosed,
    );
    assertEquivalent(
      `${adapter.type} indented HTML opening`,
      baseline,
      indentedOpening,
    );
    assertEquivalent(
      `${adapter.type} indented HTML close`,
      baseline,
      indentedClose,
    );
    assertEquivalent(`${adapter.type} indented fence`, baseline, indented);
    assertEquivalent(
      `${adapter.type} malformed HTML close`,
      baseline,
      malformedClose,
    );
    assertEquivalent(`${adapter.type} HTML comment`, baseline, commented);
    assertEquivalent(
      `${adapter.type} commented HTML tags`,
      baseline,
      commentedTags,
    );
    assertEquivalent(
      `${adapter.type} quoted comment marker`,
      baseline,
      quotedComment,
    );
  }

  const location: string = join(
    __dirname,
    `documentation precedence ${randomUUID()}`,
  );
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "evidence.json": JSON.stringify({
        claims: [
          {
            type: "php",
            files: ["contract.php"],
            symbol: "function",
            reference: {
              type: "markdown",
              files: ["rules.md"],
              symbol: "h1",
            },
          },
        ],
      }),
      "contract.php": [
        "<?php",
        "/**",
        " * ````html",
        " * <pre>",
        " * ````",
        " *     ``` literal indented delimiter",
        " * <pre>",
        " * @evidence rules.md#rendered Fake rendered statement.",
        " * </pre>",
        " *     <code>",
        " * @evidence rules.md#rule Real acknowledgement.",
        " * </code>",
        " * `````html",
        " * </pre>",
        " * `````",
        " */",
        "function run() {}",
        "",
      ].join("\n"),
      "rules.md": `# Rule {#rule}\n\nDo the work.\n`,
    },
    async (directory: string): Promise<void> => {
      const report: IEvidenceCheckReport = await EvidenceChecker.check(
        join(directory, "evidence.json"),
      );
      TestValidator.equals("PHP fenced HTML checker exit", report.exitCode, 0);
      TestValidator.equals(
        "PHP fenced HTML covered unit",
        report.counts.coveredUnits,
        1,
      );
      TestValidator.equals(
        "PHP fenced HTML missing unit",
        report.counts.missingUnits,
        0,
      );

      await EvidenceTestFileSystem.save(directory, {
        "contract.php": [
          "<?php",
          "/**",
          " * <pre>",
          " * @evidence rules.md#rule Rendered acknowledgement.",
          " */",
          "function run() {}",
          "",
        ].join("\n"),
      });
      const unclosed: IEvidenceCheckReport = await EvidenceChecker.check(
        join(directory, "evidence.json"),
      );
      TestValidator.equals(
        "PHP unclosed HTML checker exit",
        unclosed.exitCode,
        1,
      );
      TestValidator.equals(
        "PHP unclosed HTML missing unit",
        unclosed.counts.missingUnits,
        1,
      );

      await EvidenceTestFileSystem.save(directory, {
        "contract.php": [
          "<?php",
          "/**",
          " * <!--",
          " * @evidence rules.md#rule Commented acknowledgement.",
          " */",
          "function run() {}",
          "",
        ].join("\n"),
      });
      const commented: IEvidenceCheckReport = await EvidenceChecker.check(
        join(directory, "evidence.json"),
      );
      TestValidator.equals(
        "PHP unclosed HTML comment checker exit",
        commented.exitCode,
        1,
      );
    },
  );
}

/**
 * Builds the database adapter fixture with its dialect-specific qualified name.
 *
 * Every SQL certification keeps the same Evidence carrier while using a table
 * spelling that its adapter recognizes as public.
 */
function databaseSource(type: string): string {
  const model: string =
    type === "postgresql"
      ? "public.users"
      : type === "mysql"
        ? "app.users"
        : type === "sqlite"
          ? "main.users"
          : type === "bigquery"
            ? "project.dataset.users"
            : "users";
  return [
    "-- @evidence rules.md#rule Implements the table.",
    `CREATE TABLE ${model} (id INTEGER);`,
    "",
  ].join("\n");
}

/**
 * Applies one documentation mutation to a certification's unique Evidence host.
 *
 * Copying the source records keeps the canonical certification immutable, and a
 * missing or duplicate carrier fails before it can weaken the comparison.
 */
function mutateCertification(
  certification: IEvidenceAdapterCertification,
  mutation: (content: string) => string,
): IEvidenceAdapterCertification {
  let changed: number = 0;
  const sources: IEvidenceAdapterCertificationSource[] = certification.sources.map(
    (
      source: IEvidenceAdapterCertificationSource,
    ): IEvidenceAdapterCertificationSource => {
      if (changed !== 0 || !source.content.includes("@evidence "))
        return source;
      ++changed;
      return { ...source, content: mutation(source.content) };
    },
  );
  if (changed !== 1)
    throw new Error(
      `${certification.type} fixture has no unique evidence carrier to mutate.`,
    );
  return { ...certification, sources };
}

/**
 * Surrounds real evidence with literal HTML and unequal Markdown fences.
 *
 * The mutation verifies that code boundaries pair by their own syntax instead
 * of crossing visible documentation and consuming the real annotation.
 */
function separatedFences(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}Literal \`<pre>\` and \`</pre>\` examples.`,
      `${prefix}\`\`\`\`html`,
      `${prefix}<pre>`,
      `${prefix}\`\`\`\``,
      line,
      `${prefix}\`\`\`\`\`html`,
      `${prefix}</pre>`,
      `${prefix}\`\`\`\`\``,
      `${prefix}\`\`\`\`text`,
      `${prefix}@evidence rules.md#fenced Fake fenced statement.`,
      `${prefix}\`\`\`\``,
    ].join("\n"),
  );
}

/**
 * Places one fake Evidence statement inside a complete HTML example.
 *
 * The original statement remains after the closing tag as the only declaration
 * that may survive certification.
 */
function genuineHtmlExample(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<pre class="example">`,
      `${prefix}@evidence rules.md#rendered Fake rendered statement.`,
      `${prefix}</pre>`,
      line,
    ].join("\n"),
  );
}

/**
 * Wraps fake statements in spaced and compact slash-closed HTML openings.
 *
 * CommonMark and HTML keep `pre` open until the later end tag, so the fake tag
 * must remain inert even though the opening text ends in `/>`.
 */
function slashClosedHtmlOpening(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<pre />`,
      `${prefix}@evidence rules.md#rendered Fake spaced-slash statement.`,
      `${prefix}</pre>`,
      `${prefix}<pre/>`,
      `${prefix}@evidence rules.md#rendered Fake compact-slash statement.`,
      `${prefix}</pre>`,
      line,
    ].join("\n"),
  );
}

/**
 * Places valid self-closing XML examples before C# evidence.
 *
 * C# documentation uses XML element semantics, so slash-closed tags, including
 * one with `>` inside a quoted attribute, must not consume the following
 * annotation.
 */
function xmlSelfClosingExample(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<code />`,
      `${prefix}<code/>`,
      `${prefix}<code value=">"/>`,
      line,
    ].join("\n"),
  );
}

/**
 * Opens an HTML example after the real statement and leaves it unclosed.
 *
 * The opening owns the remainder of the documentation carrier, keeping the
 * appended fake annotation inert without hiding the preceding real one.
 */
function unclosedHtmlExample(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      line,
      `${prefix}<pre>`,
      `${prefix}@evidence rules.md#rendered Fake rendered statement.`,
    ].join("\n"),
  );
}

/**
 * Places an HTML opening inside Markdown indented code before real evidence.
 *
 * The literal opening must not pair with the later close across the real
 * annotation.
 */
function indentedHtmlOpening(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [`${prefix}    <pre>`, line, `${prefix}</pre>`].join("\n"),
  );
}

/**
 * Places a literal indented close inside an active HTML example.
 *
 * The close cannot terminate the outer region, so the fake statement remains
 * hidden until the genuine non-indented closing tag.
 */
function indentedHtmlClose(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<pre>`,
      `${prefix}    </pre>`,
      `${prefix}@evidence rules.md#rendered Fake rendered statement.`,
      `${prefix}</pre>`,
      line,
    ].join("\n"),
  );
}

/**
 * Places a fence-looking indented line before a genuine HTML example.
 *
 * Indented code cannot open a fence that would change how the following HTML
 * region and real annotation are classified.
 */
function indentedFenceBeforeHtml(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}    \`\`\` literal indented delimiter`,
      `${prefix}<pre>`,
      `${prefix}@evidence rules.md#rendered Fake rendered statement.`,
      `${prefix}</pre>`,
      line,
    ].join("\n"),
  );
}

/**
 * Inserts an attribute-bearing HTML end tag before the valid close.
 *
 * The malformed tag must not end the example or expose the second fake Evidence
 * statement.
 */
function malformedHtmlClose(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<pre>`,
      `${prefix}@evidence rules.md#rendered First fake rendered statement.`,
      `${prefix}</pre class="invalid">`,
      `${prefix}@evidence rules.md#rendered Second fake rendered statement.`,
      `${prefix}</pre>`,
      line,
    ].join("\n"),
  );
}

/**
 * Places one fake Evidence statement inside a complete HTML comment.
 *
 * The original statement follows the comment and remains the only eligible
 * declaration.
 */
function htmlCommentedEvid(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}<!--`,
      `${prefix}@evidence rules.md#commented Fake commented statement.`,
      `${prefix}-->`,
      line,
    ].join("\n"),
  );
}

/**
 * Separates HTML comment delimiters into independent Markdown fences.
 *
 * Literal delimiters inside fenced examples cannot pair across the real
 * statement and suppress its Evidence declaration.
 */
function fencedHtmlCommentLiteral(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      `${prefix}\`\`\`\`html`,
      `${prefix}<!--`,
      `${prefix}\`\`\`\``,
      line,
      `${prefix}\`\`\`\`html`,
      `${prefix}-->`,
      `${prefix}\`\`\`\``,
    ].join("\n"),
  );
}

/**
 * Places a comment-looking marker inside a quoted markup attribute.
 *
 * The complete tag token owns the marker, so it cannot open comment state and
 * hide the real Evidence statement that follows.
 */
function quotedHtmlCommentLiteral(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [`${prefix}<span title="<!-- literal marker">`, line].join("\n"),
  );
}

/**
 * Places literal HTML example boundaries inside separate comments.
 *
 * Comment contents cannot open or close an example around the real Evidence
 * statement between them.
 */
function commentedHtmlTags(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [`${prefix}<!-- <pre> -->`, line, `${prefix}<!-- </pre> -->`].join("\n"),
  );
}

/**
 * Separates literal HTML tags with one adapter-native code syntax.
 *
 * If HTML pairing ignores the native regions, their opening and closing
 * literals cross the real Evidence statement and remove it from the certified
 * inventory.
 */
function nativeCodePrecedence(type: string, content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string => {
    if (type === "c" || type === "cpp")
      return [
        `${prefix}@code`,
        `${prefix}<pre>`,
        `${prefix}@endcode`,
        line,
        `${prefix}@code`,
        `${prefix}</pre>`,
        `${prefix}@endcode`,
      ].join("\n");
    if (type === "java")
      return [`${prefix}{@code <pre>}`, line, `${prefix}{@code </pre>}`].join(
        "\n",
      );
    if (type === "scala")
      return [`${prefix}{{{ <pre> }}}`, line, `${prefix}{{{ </pre> }}}`].join(
        "\n",
      );
    throw new Error(`No native documentation example syntax for ${type}.`);
  });
}

/**
 * Separates native documentation delimiters into independent Markdown fences.
 *
 * Literal Doxygen, Javadoc, and Scaladoc openings cannot own the real Evidence
 * statement before a later fenced closing delimiter.
 */
function markdownNativeLiteral(type: string, content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string => {
    let opening: string;
    let closing: string;
    if (type === "c" || type === "cpp") {
      opening = "@code";
      closing = "@endcode";
    } else if (type === "java") {
      opening = "{@code";
      closing = "}";
    } else if (type === "scala") {
      opening = "{{{";
      closing = "}}}";
    } else
      throw new Error(`No native documentation example syntax for ${type}.`);
    return [
      `${prefix}\`\`\`\`text`,
      `${prefix}${opening}`,
      `${prefix}\`\`\`\``,
      line,
      `${prefix}\`\`\`\`text`,
      `${prefix}${closing}`,
      `${prefix}\`\`\`\``,
    ].join("\n");
  });
}

/**
 * Appends a fake statement after an unclosed Doxygen code boundary.
 *
 * The code region owns the remainder of the documentation host, so the injected
 * statement must not become a second Evidence declaration.
 */
function unclosedDoxygenCode(content: string): string {
  return replaceEvidenceLine(content, (prefix: string, line: string): string =>
    [
      line,
      `${prefix}@code`,
      `${prefix}@evidence rules.md#native Fake native-code statement.`,
    ].join("\n"),
  );
}

/**
 * Replaces the unique Evidence line while retaining its documentation prefix.
 *
 * Adapter fixtures use different comment delimiters, so mutations receive the
 * exact prefix and complete line rather than assuming one documentation
 * syntax.
 */
function replaceEvidenceLine(
  content: string,
  replacement: (prefix: string, line: string) => string,
): string {
  const annotation: number = content.indexOf("@evidence ");
  if (annotation < 0)
    throw new Error("Documentation fixture has no evidence line.");
  const start: number = content.lastIndexOf("\n", annotation) + 1;
  const newline: number = content.indexOf("\n", annotation);
  const end: number = newline < 0 ? content.length : newline;
  const prefix: string = content.slice(start, annotation);
  const line: string = content.slice(start, end);
  return `${content.slice(0, start)}${replacement(prefix, line)}${content.slice(end)}`;
}

/**
 * Requires a mutated certification to preserve the baseline semantic inventory.
 *
 * Unit identities, declarations, completeness, and diagnostics together ensure
 * that example masking changes only ineligible documentation text.
 */
function assertEquivalent(
  label: string,
  baseline: IEvidenceInventory,
  candidate: IEvidenceInventory,
): void {
  if (!candidate.complete)
    throw new Error(
      `${label} became incomplete: ${JSON.stringify(candidate.diagnostics)}`,
    );
  TestValidator.equals(`${label} completeness`, candidate.complete, true);
  TestValidator.equals(
    `${label} units`,
    candidate.units.map((unit: IEvidenceUnit): string =>
      JSON.stringify([unit.symbol, unit.identity]),
    ),
    baseline.units.map((unit: IEvidenceUnit): string =>
      JSON.stringify([unit.symbol, unit.identity]),
    ),
  );
  TestValidator.equals(
    `${label} declarations`,
    candidate.declarations.map(
      (declaration: IEvidenceDeclaration): string => declaration.target,
    ),
    baseline.declarations.map(
      (declaration: IEvidenceDeclaration): string => declaration.target,
    ),
  );
  TestValidator.equals(`${label} diagnostics`, candidate.diagnostics, []);
}
