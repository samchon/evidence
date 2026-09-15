import { EvidSqlAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Distinguishes leading SQL documentation from trailing and detached comments.
 *
 * Attachment is determined by the declaration boundary, so adjacent comment positions can have different acknowledgement effects.
 *
 * 1. Analyze leading, trailing, and detached SQL comment carriers.
 * 2. Verify only the supported leading comment attaches.
 * 3. Require exact host and declaration outcomes.
 */
export async function test_sql_comment_boundaries(): Promise<void> {
  const adapter = new EvidSqlAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create(
      "comments.sql",
      dedent`
    CREATE TABLE account (
      first INTEGER, -- @evid docs/spec.md#trailing A trailing comment.
      -- @evid docs/spec.md#leading A separate leading comment.
      second INTEGER,
      -- @evid docs/spec.md#detached A detached comment.

      third INTEGER
    );
  `,
    ),
  );
  TestValidator.equals(
    "comment boundaries preserve the complete table",
    inventory.complete,
    true,
  );
  const attached = inventory.declarations.filter((declaration) =>
    inventory.hosts.some(
      (host) =>
        host.id === declaration.hostId && host.attachment === "attached",
    ),
  );
  TestValidator.equals(
    "only standalone adjacent comment attaches",
    attached.map((entry) => entry.target),
    ["docs/spec.md#leading"],
  );
  TestValidator.equals(
    "trailing and blank-separated tags are diagnosed",
    inventory.diagnostics.filter(
      (entry) => entry.code === "unsupported-annotation-host",
    ).length,
    2,
  );
  const owner = inventory.hosts.find((host) => host.id === attached[0]?.hostId);
  const ownerIds = new Set(owner === undefined ? [] : owner.unitIds);
  TestValidator.equals(
    "leading documentation owns exactly the second column",
    inventory.units
      .filter((unit) => ownerIds.has(unit.id))
      .map((unit) => unit.name),
    ["SECOND"],
  );
}
