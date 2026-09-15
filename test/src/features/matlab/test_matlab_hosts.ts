import { EvidFingerprint, EvidMatlabAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches MATLAB help annotations only at supported declaration sites.
 *
 * Preceding and inline help can document declarations, whereas executable comments, examples, blocks, and strings must remain inert.
 *
 * 1. Analyze CRLF class, property, and method help with competing comment placements.
 * 2. Verify the exact eligible targets, UTF-16 positions, and withdrawal handling.
 * 3. Compare fingerprints after documentation-only and semantic edits.
 */
export async function test_matlab_hosts(): Promise<void> {
  const content = dedent`
    % @evid doc.md#unattached Unattached file header.
    classdef Contract
      % Unicode 한글 😀 help.
      % @evid doc.md#type Type documentation.
      properties
        %{
        @evid doc.md#precedingBlock Ordinary block does not absorb help.
        %}
        % @evid doc.md#property Preferred preceding help.
        value = 1 % @evid doc.md#ignored Inline loses precedence.
        %{
        @evid doc.md#inlineBlock Ordinary block does not override inline help.
        %}
        inline % @evid doc.md#inline Inline documentation.
        % @internal Withdraw this property.
        legacy
        % @evid doc.md#next Next property help.
        next
      end
      methods
        function result = run(obj)
          % @evid doc.md#function Function documentation.
          % <pre>
          % @evid doc.md#html HTML code is inert.
          % </pre>
          % ${"```"}matlab
          % @evid doc.md#fenced Fenced code is inert.
          % ${"```"}
          % Example:
          %     @evid doc.md#example Example is inert.
          result = "@evid doc.md#string Strings are inert.";
          % @evid doc.md#body Executable comments are inert.
        end
        function block(obj)
          %{
          @evid doc.md#block Block help.
          %}
        end
      end
    end
  `
    .concat("\n")
    .replaceAll("\n", "\r\n");
  const adapter = new EvidMatlabAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.m", content),
  );

  TestValidator.equals("complete help extraction", inventory.diagnostics, []);
  TestValidator.equals(
    "exact eligible tags",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort((left, right) => left.localeCompare(right)),
    [
      "doc.md#type",
      "doc.md#property",
      "doc.md#inline",
      "doc.md#next",
      "doc.md#function",
    ].sort((left, right) => left.localeCompare(right)),
  );
  for (const declaration of inventory.declarations)
    TestValidator.equals(
      `UTF-16 ${declaration.target}`,
      declaration.location.range?.start?.offset,
      content.indexOf(`@evid ${declaration.target} `),
    );
  const legacy = inventory.units.find((unit) => unit.name === "legacy");
  TestValidator.equals(
    "withdrawal retained",
    legacy === undefined
      ? undefined
      : legacy.withdrawals.map((withdrawal) => withdrawal.tag),
    ["internal"],
  );
  TestValidator.equals(
    "withdrawn host removed",
    inventory.hosts.some((host) => host.unitIds.includes(legacy?.id ?? "")),
    false,
  );
  const unit = inventory.units.find((candidate) => candidate.name === "run");
  if (unit === undefined) throw new Error("Missing function inventory.");
  const annotation = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Contract.m",
      content.replace("Function documentation.", "Updated documentation."),
    ),
  );
  const semantic = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Contract.m",
      content.replace('result = "', 'result = "Changed '),
    ),
  );
  TestValidator.equals(
    "annotation stable review",
    EvidFingerprint.inspect(inventory, unit.id).fingerprint,
    EvidFingerprint.inspect(annotation, unit.id).fingerprint,
  );
  TestValidator.notEquals(
    "semantic review invalidation",
    EvidFingerprint.inspect(inventory, unit.id).fingerprint,
    EvidFingerprint.inspect(semantic, unit.id).fingerprint,
  );
}
