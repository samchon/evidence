import { EvidenceChecker, EvidencePythonAdapter } from "evidence";
import type {
  IEvidenceCheckReport,
  IEvidenceDeclaration,
  IEvidenceDiagnostic,
  IEvidenceHost,
  IEvidenceInventory,
  IEvidencePublicAddress,
  IEvidenceUnit,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Isolates surviving Python bindings from metadata on replaced definitions.
 *
 * Executable Python definitions assign new objects in source order. Treating a
 * repeated spelling as declaration merging lets dead evidence or withdrawals
 * govern the public object that actually survives, producing false coverage or
 * hiding an unrelated replacement.
 *
 * 1. Analyze repeated module functions, async functions, class methods,
 *    constructors, and plain properties whose first definitions alone carry
 *    evidence; require one-site survivors without fields from dead
 *    constructors.
 * 2. Replace a withdrawn class with a fresh class and require only the new class
 *    and member, with no inherited withdrawal or obsolete child.
 * 3. Reexport a repeated function from another module and require its public alias
 *    to resolve to the final binding rather than the replaced site.
 * 4. Replace module and class bindings across symbol kinds; require only the final
 *    kind, remove obsolete nested descendants, retain an accessor family only
 *    when its decorator extends the same binding, and prevent module or class
 *    augmented updates from preserving another kind.
 * 5. Run the original false-success fixture through EvidenceChecker and require one
 *    uncovered requirement; remove the obsolete definition and require the same
 *    coverage outcome for the byte-identical survivor.
 * 6. Attach evidence to the final definition and require recovery to a passing
 *    check. Existing stub overload and property-family tests remain separate
 *    positive controls in the focused Python validation set.
 */
export async function test_python_redefinitions(): Promise<void> {
  const repeated: IEvidenceInventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "contract.py",
      [
        "# @evidence rules.md#rule Replaced function.",
        "def run():",
        "    return 1",
        "",
        "def run():",
        "    return 2",
        "",
        "# @evidence rules.md#rule Replaced async function.",
        "async def fetch():",
        "    return 1",
        "",
        "async def fetch():",
        "    return 2",
        "",
        "class Service:",
        "    # @evidence rules.md#rule Replaced method.",
        "    def call(self):",
        "        return 1",
        "",
        "    def call(self):",
        "        return 2",
        "",
        "    # @evidence rules.md#rule Replaced property.",
        "    @property",
        "    def value(self):",
        "        return 1",
        "",
        "    @property",
        "    def value(self):",
        "        return 2",
        "",
        "class Constructor:",
        "    def __init__(self):",
        "        self.obsolete = 1",
        "",
        "    def __init__(self):",
        "        self.current = 2",
        "        self.repeated = 1",
        "        self.repeated = 2",
        "",
        "class EmptyConstructor:",
        "    def __init__(self):",
        "        self.obsolete_empty = 1",
        "",
        "    def __init__(self):",
        "        pass",
        "",
        "class Outer:",
        "    class Nested:",
        "        def __init__(self):",
        "            self.obsolete_nested = 1",
        "",
        "        def __init__(self):",
        "            self.current_nested = 2",
        "",
      ].join("\n"),
    ),
  );
  for (const identity of ["run", "fetch", "call", "value"]) {
    const unit: IEvidenceUnit = requireUnit(repeated, identity);
    TestValidator.equals(
      `${identity} surviving declaration site`,
      unit.sites.length,
      1,
    );
    TestValidator.predicate(
      `${identity} does not inherit replaced evidence`,
      repeated.hosts.every(
        (host: IEvidenceHost): boolean =>
          !host.unitIds.includes(unit.id) ||
          !repeated.declarations.some(
            (declaration: IEvidenceDeclaration): boolean =>
              declaration.hostId === host.id,
          ),
      ),
    );
  }
  requireIdentity(repeated, "Constructor.prototype.current");
  TestValidator.equals(
    "surviving constructor keeps last field assignment",
    requireIdentity(repeated, "Constructor.prototype.repeated").sites.length,
    1,
  );
  requireIdentity(repeated, "Outer.Nested.prototype.current_nested");
  TestValidator.predicate(
    "replaced constructor fields removed",
    repeated.units.every(
      (unit: IEvidenceUnit): boolean =>
        !["obsolete", "obsolete_empty", "obsolete_nested"].includes(unit.name),
    ),
  );

  const replacedClass: IEvidenceInventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "classes.py",
      [
        "# @internal Replaced class.",
        "class Contract:",
        "    old = 1",
        "",
        "class Contract:",
        "    current = 2",
        "",
      ].join("\n"),
    ),
  );
  const contract: IEvidenceUnit = requireUnit(replacedClass, "Contract");
  TestValidator.equals("replacement class site", contract.sites.length, 1);
  TestValidator.equals(
    "replacement class withdrawals",
    contract.withdrawals,
    [],
  );
  TestValidator.predicate(
    "replacement class current member",
    replacedClass.units.some(
      (unit: IEvidenceUnit): boolean => unit.name === "current",
    ),
  );
  TestValidator.predicate(
    "replacement class obsolete member removed",
    replacedClass.units.every(
      (unit: IEvidenceUnit): boolean => unit.name !== "old",
    ),
  );

  const reexported: IEvidenceInventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "package/contract.py",
        `def run():\n    return 1\n\ndef run():\n    return 2\n`,
      ),
      EvidenceTestSourceSnapshot.create(
        "package/api.py",
        `from .contract import run as public\n\n__all__ = ["public"]\n`,
      ),
    ]),
  );
  const survivingRun: IEvidenceUnit = requireUnit(reexported, "run");
  TestValidator.equals(
    "reexported survivor site",
    survivingRun.sites.length,
    1,
  );
  TestValidator.predicate(
    "reexport resolves final binding",
    reexported.addresses.some(
      (address: IEvidencePublicAddress): boolean =>
        address.unitId === survivingRun.id &&
        address.file.endsWith("/package/api.py") &&
        address.segments.join(".") === "public",
    ),
  );

  const crossKind: IEvidenceInventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "cross-kind.py",
      [
        "# @evidence rules.md#rule Replaced module function.",
        "def top():",
        "    return 'function'",
        "top = 'property'",
        "",
        "# @evidence rules.md#rule Replaced augmented module function.",
        "@runtime_value",
        "def module_augmented():",
        "    return 'function'",
        "module_augmented += 1",
        "",
        "class Service:",
        "    # @evidence rules.md#rule Replaced method.",
        "    def convert(self):",
        "        return 'method'",
        "    convert = 'property'",
        "",
        "    # @evidence rules.md#rule Replaced property.",
        "    operate = 'property'",
        "    def operate(self):",
        "        return 'method'",
        "",
        "    # @internal Replaced nested class.",
        "    class Contract:",
        "        obsolete = True",
        "",
        "    class Contract:",
        "        current = True",
        "",
        "class Access:",
        "    @property",
        "    def value(self):",
        "        return 1",
        "",
        "    @value.setter",
        "    def value(self, replacement):",
        "        pass",
        "",
        "class ReboundAccess:",
        "    # @evidence rules.md#rule Replaced getter.",
        "    @property",
        "    def value(self):",
        "        return 1",
        "",
        "    @property",
        "    def source(self):",
        "        return 2",
        "",
        "    @source.setter",
        "    def value(self, replacement):",
        "        pass",
        "",
        "class Augmented:",
        "    # @evidence rules.md#rule Replaced decorated method.",
        "    @runtime_value",
        "    def changed(self):",
        "        return 1",
        "    changed += 1",
        "",
      ].join("\n"),
    ),
  );
  TestValidator.equals(
    "module cross-kind replacement",
    requireUnit(crossKind, "top").symbol,
    "property",
  );
  TestValidator.equals(
    "module augmented assignment replaces a prior symbol kind",
    requireUnit(crossKind, "module_augmented").symbol,
    "property",
  );
  TestValidator.equals(
    "method-to-property replacement",
    requireIdentity(crossKind, "Service.convert").symbol,
    "property",
  );
  TestValidator.equals(
    "property-to-method replacement",
    requireIdentity(crossKind, "Service.prototype.operate").symbol,
    "function",
  );
  const nested: IEvidenceUnit = requireIdentity(crossKind, "Service.Contract");
  TestValidator.equals(
    "replacement nested class sites",
    nested.sites.length,
    1,
  );
  TestValidator.equals(
    "replacement nested class withdrawals",
    nested.withdrawals,
    [],
  );
  requireIdentity(crossKind, "Service.Contract.current");
  TestValidator.predicate(
    "obsolete nested descendant removed",
    crossKind.units.every(
      (unit: IEvidenceUnit): boolean => unit.name !== "obsolete",
    ),
  );
  TestValidator.equals(
    "property accessor family retained",
    requireIdentity(crossKind, "Access.prototype.value").sites.length,
    2,
  );
  TestValidator.equals(
    "accessor from another binding replaces prior property",
    requireIdentity(crossKind, "ReboundAccess.prototype.value").sites.length,
    1,
  );
  TestValidator.equals(
    "augmented assignment replaces a prior symbol kind",
    requireIdentity(crossKind, "Augmented.changed").symbol,
    "property",
  );
  TestValidator.equals(
    "cross-kind obsolete metadata rejected",
    crossKind.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    [
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
    ],
  );

  const location: string = join(
    __dirname,
    `python redefinitions ${randomUUID()}`,
  );
  const survivor: string = `def run():\n    return 2\n`;
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "evidence.json": JSON.stringify({
        claims: [
          {
            type: "python",
            files: ["contract.py"],
            symbol: "function",
            reference: {
              type: "markdown",
              files: ["rules.md"],
              symbol: "h1",
            },
          },
        ],
      }),
      "contract.py": `# @evidence rules.md#rule Replaced implementation.\ndef run():\n    return 1\n\n${survivor}`,
      "rules.md": `# Rule {#rule}\n\nDo the work.\n`,
    },
    async (directory: string): Promise<void> => {
      const config: string = join(directory, "evidence.json");
      const withHistory: IEvidenceCheckReport = await EvidenceChecker.check(config);
      TestValidator.equals(
        "replaced evidence cannot cover",
        withHistory.exitCode,
        1,
      );
      TestValidator.equals(
        "replaced evidence missing unit",
        withHistory.counts.missingUnits,
        1,
      );

      await EvidenceTestFileSystem.save(directory, { "contract.py": survivor });
      const withoutHistory: IEvidenceCheckReport = await EvidenceChecker.check(config);
      TestValidator.equals(
        "removing dead history keeps outcome",
        withoutHistory.exitCode,
        1,
      );
      TestValidator.equals(
        "survivor remains uncovered",
        withoutHistory.counts.missingUnits,
        1,
      );

      await EvidenceTestFileSystem.save(directory, {
        "contract.py": `# @evidence rules.md#rule Current implementation.\n${survivor}`,
      });
      const recovered: IEvidenceCheckReport = await EvidenceChecker.check(config);
      TestValidator.equals(
        "current evidence recovers coverage",
        recovered.exitCode,
        0,
      );
      TestValidator.equals(
        "current evidence covers unit",
        recovered.counts.coveredUnits,
        1,
      );
    },
  );
}

/**
 * Requires one uniquely named Python declaration from a scenario inventory.
 *
 * The fixtures avoid overloads for these names, so absence or duplication is a
 * scanner failure rather than a valid alternative selection.
 */
function requireUnit(inventory: IEvidenceInventory, name: string): IEvidenceUnit {
  const units: IEvidenceUnit[] = inventory.units.filter(
    (unit: IEvidenceUnit): boolean => unit.name === name,
  );
  const unit: IEvidenceUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error(`Expected one Python unit named ${name}.`);
  return unit;
}

/**
 * Requires one Python declaration at an exact semantic identity.
 *
 * Cross-kind class replacements can change the final address projection while
 * retaining the same runtime binding name, so their full owner path is the
 * meaningful assertion boundary.
 */
function requireIdentity(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const units: IEvidenceUnit[] = inventory.units.filter(
    (unit: IEvidenceUnit): boolean => unit.identity.join(".") === identity,
  );
  const unit: IEvidenceUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error(`Expected one Python unit at ${identity}.`);
  return unit;
}
