import { EvidenceSqlAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps adjacent leading documentation distinct from trailing and detached comment carriers. */
export async function test_sql_comment_boundaries(): Promise<void> {
  const adapter = new EvidenceSqlAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create(
      "comments.sql",
      dedent`
    CREATE TABLE account (
      first INTEGER, -- @evidence docs/spec.md#trailing A trailing comment.
      -- @evidence docs/spec.md#leading A separate leading comment.
      second INTEGER,
      -- @evidence docs/spec.md#detached A detached comment.

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
