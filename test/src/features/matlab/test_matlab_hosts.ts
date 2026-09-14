import { EvidenceFingerprint, EvidenceMatlabAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches official help placements while keeping executable comments, examples, and strings inert. */
export async function test_matlab_hosts(): Promise<void> {
  const content = dedent`
    % @evidence doc.md#unattached Unattached file header.
    classdef Contract
      % Unicode 한글 😀 help.
      % @evidence doc.md#type Type documentation.
      properties
        % @evidence doc.md#property Preferred preceding help.
        value = 1 % @evidence doc.md#ignored Inline loses precedence.
        inline % @evidence doc.md#inline Inline documentation.
        % @internal Withdraw this property.
        legacy
        % @evidence doc.md#next Next property help.
        next
      end
      methods
        function result = run(obj)
          % @evidence doc.md#function Function documentation.
          % Example:
          %     @evidence doc.md#example Example is inert.
          result = "@evidence doc.md#string Strings are inert.";
          % @evidence doc.md#body Executable comments are inert.
        end
        function block(obj)
          %{
          @evidence doc.md#block Block help.
          %}
        end
      end
    end
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceMatlabAdapter();
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.m", content),
  );

  TestValidator.equals("complete help extraction", inventory.diagnostics, []);
  TestValidator.equals(
    "exact eligible tags",
    inventory.declarations.map((declaration) => declaration.target).sort(),
    [
      "doc.md#type",
      "doc.md#property",
      "doc.md#inline",
      "doc.md#next",
      "doc.md#function",
    ].sort(),
  );
  for (const declaration of inventory.declarations)
    TestValidator.equals(
      `UTF-16 ${declaration.target}`,
      declaration.location.range?.start?.offset,
      content.indexOf(`@evidence ${declaration.target}`),
    );
  const legacy = inventory.units.find((unit) => unit.name === "legacy");
  TestValidator.equals(
    "withdrawal retained",
    legacy?.withdrawals?.map((withdrawal) => withdrawal.tag),
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
    EvidenceFingerprint.inspect(inventory, unit.id).fingerprint,
    EvidenceFingerprint.inspect(annotation, unit.id).fingerprint,
  );
  TestValidator.notEquals(
    "semantic review invalidation",
    EvidenceFingerprint.inspect(inventory, unit.id).fingerprint,
    EvidenceFingerprint.inspect(semantic, unit.id).fingerprint,
  );
}
