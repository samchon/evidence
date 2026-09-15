import { EvidenceChecker, EvidenceJavaScriptAdapter } from "evidence";
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
 * Isolates surviving JavaScript bindings from documentation on replaced
 * definitions.
 *
 * JavaScript function declarations and duplicate class members select the last
 * runtime value for a spelling. Merging their sites would let evidence attached
 * only to dead code cover the exported value that consumers execute.
 *
 * 1. Analyze repeated module functions, instance methods, instance fields, and
 *    static methods whose first definitions alone carry evidence.
 * 2. Require one-site surviving units and verify obsolete evidence has no
 *    attachment to those units.
 * 3. Export the repeated function and class through CommonJS and require every
 *    public address to resolve to the surviving unit IDs.
 * 4. Mix function declarations with initialized and uninitialized `var`
 *    declarations; require runtime initialization and hoisting order to select
 *    the same binding that EvidenceNode executes.
 * 5. Repeat initialized variables and class fields across symbol kinds; require
 *    the last runtime assignment, account for static fields running after
 *    method installation, and preserve separate instance/prototype slots.
 * 6. Replace supported methods with excluded accessors and reverse that order;
 *    require the final class slot to decide whether a unit remains.
 * 7. Run a replaced-function fixture through EvidenceChecker and require one
 *    missing unit; remove the dead definition and require the same outcome.
 * 8. Attach evidence to the final definition and require recovery to a passing
 *    check.
 */
export async function test_javascript_redefinitions(): Promise<void> {
  const repeated: IEvidenceInventory =
    await new EvidenceJavaScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/redefinitions.cjs",
        [
          "/** @evidence rules.md#rule Replaced function. */",
          "function run() { return 1; }",
          "function run() { return 2; }",
          "",
          "class Service {",
          "  /** @evidence rules.md#rule Replaced method. */",
          "  call() { return 1; }",
          "  call() { return 2; }",
          "",
          "  /** @evidence rules.md#rule Replaced field. */",
          "  value = 1;",
          "  value = 2;",
          "",
          "  /** @evidence rules.md#rule Replaced static method. */",
          "  static create() { return 1; }",
          "  static create() { return 2; }",
          "}",
          "",
          "module.exports = { run, Service };",
          "",
        ].join("\n"),
      ),
    );

  const run: IEvidenceUnit = requireUnit(repeated, "run");
  const call: IEvidenceUnit = requireUnit(repeated, "Service.prototype.call");
  const value: IEvidenceUnit = requireUnit(repeated, "Service.prototype.value");
  const create: IEvidenceUnit = requireUnit(repeated, "Service.create");
  const namedUnits: Array<readonly [string, IEvidenceUnit]> = [
    ["run", run],
    ["call", call],
    ["value", value],
    ["create", create],
  ];
  for (const [name, unit] of namedUnits) {
    TestValidator.equals(
      `${name} surviving declaration site`,
      unit.sites.length,
      1,
    );
    TestValidator.predicate(
      `${name} does not inherit replaced evidence`,
      repeated.declarations.every(
        (declaration: IEvidenceDeclaration): boolean => {
          const host: IEvidenceHost | undefined = repeated.hosts.find(
            (candidate: IEvidenceHost): boolean =>
              candidate.id === declaration.hostId,
          );
          return host === undefined || !host.unitIds.includes(unit.id);
        },
      ),
    );
  }

  const addresses: Map<string, string> = new Map<string, string>(
    repeated.addresses.map(
      (address: IEvidencePublicAddress): [string, string] => [
        address.segments.join("."),
        address.unitId,
      ],
    ),
  );
  TestValidator.equals(
    "CommonJS function survivor",
    addresses.get("run"),
    run.id,
  );
  TestValidator.equals(
    "CommonJS method survivor",
    addresses.get("Service.prototype.call"),
    call.id,
  );
  TestValidator.equals(
    "CommonJS field survivor",
    addresses.get("Service.prototype.value"),
    value.id,
  );
  TestValidator.equals(
    "CommonJS static survivor",
    addresses.get("Service.create"),
    create.id,
  );
  TestValidator.equals(
    "obsolete evidence is rejected explicitly",
    repeated.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    [
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
    ],
  );

  const hoisted: IEvidenceInventory =
    await new EvidenceJavaScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/hoisting.cjs",
        [
          "/** @evidence rules.md#rule Replaced before initializer. */",
          "function before() { return 'function'; }",
          "var before = () => 'variable';",
          "",
          "var after = () => 'variable';",
          "/** @evidence rules.md#rule Replaced after initializer. */",
          "function after() { return 'function'; }",
          "",
          "var retainedBefore;",
          "function retainedBefore() { return 'function'; }",
          "function retainedAfter() { return 'function'; }",
          "var retainedAfter;",
          "",
          "module.exports = { before, after, retainedBefore, retainedAfter };",
          "",
        ].join("\n"),
      ),
    );
  TestValidator.equals(
    "initialized var bindings replace hoisted functions",
    hoisted.units
      .filter((unit: IEvidenceUnit): boolean =>
        ["before", "after"].includes(unit.name),
      )
      .map((unit: IEvidenceUnit): string => `${unit.symbol}:${unit.name}`)
      .sort((left: string, right: string): number =>
        left.localeCompare(right, "en"),
      ),
    ["property:after", "property:before"],
  );
  TestValidator.equals(
    "uninitialized var declarations preserve hoisted functions",
    hoisted.units
      .filter((unit: IEvidenceUnit): boolean =>
        ["retainedBefore", "retainedAfter"].includes(unit.name),
      )
      .map((unit: IEvidenceUnit): string => `${unit.symbol}:${unit.name}`)
      .sort((left: string, right: string): number =>
        left.localeCompare(right, "en"),
      ),
    ["function:retainedAfter", "function:retainedBefore"],
  );
  TestValidator.equals(
    "replaced cross-kind evidence is rejected",
    hoisted.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    ["unsupported-annotation-host", "unsupported-annotation-host"],
  );

  const initialized: IEvidenceInventory =
    await new EvidenceJavaScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/initialized.cjs",
        [
          "/** @evidence rules.md#rule Replaced initializer. */",
          "var repeated = 1;",
          "var repeated = 2;",
          "var repeated;",
          "/** @evidence rules.md#rule Replaced same-statement initializer. */",
          "var combined = 1, combined = 2;",
          "module.exports = { repeated, combined };",
          "",
        ].join("\n"),
      ),
    );
  const initializedNames: string[] = ["repeated", "combined"];
  for (const name of initializedNames)
    TestValidator.equals(
      `${name} last initialized var site`,
      requireUnit(initialized, name).sites.length,
      1,
    );
  TestValidator.equals(
    "obsolete variable evidence is rejected",
    initialized.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    ["unsupported-annotation-host"],
  );

  const crossKindMembers: IEvidenceInventory =
    await new EvidenceJavaScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/member-kinds.cjs",
        [
          "class Mixed {",
          "  /** @evidence rules.md#rule Replaced static function field. */",
          "  static value = () => 1;",
          "  static value = 2;",
          "  /** @evidence rules.md#rule Replaced static property field. */",
          "  static execute = 1;",
          "  static execute() {}",
          "  /** @evidence rules.md#rule Replaced instance function field. */",
          "  handler = () => 1;",
          "  handler = 2;",
          "  invoke() {}",
          "  invoke = 1;",
          "}",
          "module.exports = Mixed;",
          "",
        ].join("\n"),
      ),
    );
  TestValidator.equals(
    "static field symbol replacement",
    requireUnit(crossKindMembers, "Mixed.value").symbol,
    "property",
  );
  TestValidator.equals(
    "static field initializes after method installation",
    requireUnit(crossKindMembers, "Mixed.execute").symbol,
    "property",
  );
  TestValidator.equals(
    "instance field symbol replacement",
    requireUnit(crossKindMembers, "Mixed.prototype.handler").symbol,
    "property",
  );
  TestValidator.equals(
    "prototype method and instance field coexist",
    crossKindMembers.units.filter(
      (unit: IEvidenceUnit): boolean =>
        unit.identity.join(".") === "Mixed.prototype.invoke",
    ).length,
    2,
  );
  TestValidator.equals(
    "obsolete class-member evidence is rejected",
    crossKindMembers.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    ["unsupported-annotation-host", "unsupported-annotation-host"],
  );

  const accessorSlots: IEvidenceInventory =
    await new EvidenceJavaScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/accessor-slots.cjs",
        [
          "class Accessors {",
          "  /** @evidence rules.md#rule Replaced static method. */",
          "  static hidden() {}",
          "  static get hidden() { return 1; }",
          "  /** @evidence rules.md#rule Replaced instance method. */",
          "  visible() {}",
          "  get visible() { return 1; }",
          "  static get restored() { return 1; }",
          "  static restored() {}",
          "}",
          "module.exports = Accessors;",
          "",
        ].join("\n"),
      ),
    );
  TestValidator.predicate(
    "final accessors remove replaced method units",
    accessorSlots.units.every(
      (unit: IEvidenceUnit): boolean =>
        unit.name !== "hidden" && unit.name !== "visible",
    ),
  );
  TestValidator.equals(
    "final method restores supported class slot",
    requireUnit(accessorSlots, "Accessors.restored").symbol,
    "function",
  );
  TestValidator.equals(
    "replaced method documentation remains unsupported",
    accessorSlots.diagnostics.map(
      (diagnostic: IEvidenceDiagnostic): string => diagnostic.code,
    ),
    ["unsupported-annotation-host", "unsupported-annotation-host"],
  );

  const location: string = join(
    __dirname,
    `javascript redefinitions ${randomUUID()}`,
  );
  const survivor: string =
    "function run() { return 2; }\nmodule.exports.run = run;\n";
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "evidence.json": JSON.stringify({
        claims: [
          {
            type: "javascript",
            files: ["contract.cjs"],
            symbol: "function",
            reference: {
              type: "markdown",
              files: ["rules.md"],
              symbol: "h1",
            },
          },
        ],
      }),
      "contract.cjs": `/** @evidence rules.md#rule Replaced implementation. */\nfunction run() { return 1; }\n${survivor}`,
      "rules.md": "# Rule {#rule}\n\nDo the work.\n",
    },
    async (directory: string): Promise<void> => {
      const config: string = join(directory, "evidence.json");
      const withHistory: IEvidenceCheckReport =
        await EvidenceChecker.check(config);
      TestValidator.equals(
        "replaced evidence cannot cover",
        withHistory.exitCode,
        1,
      );
      TestValidator.equals(
        "replaced evidence leaves survivor missing",
        withHistory.counts.missingUnits,
        1,
      );

      await EvidenceTestFileSystem.save(directory, {
        "contract.cjs": survivor,
      });
      const withoutHistory: IEvidenceCheckReport =
        await EvidenceChecker.check(config);
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
        "contract.cjs": `/** @evidence rules.md#rule Current implementation. */\n${survivor}`,
      });
      const recovered: IEvidenceCheckReport =
        await EvidenceChecker.check(config);
      TestValidator.equals(
        "current evidence recovers coverage",
        recovered.exitCode,
        0,
      );
      TestValidator.equals(
        "current evidence covers survivor",
        recovered.counts.coveredUnits,
        1,
      );
    },
  );
}

/**
 * Requires one JavaScript declaration with the requested semantic identity.
 *
 * Each fixture spelling has one effective runtime value, so absence or
 * duplicate units indicates that replacement selection did not match JavaScript
 * execution.
 */
function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const units: IEvidenceUnit[] = inventory.units.filter(
    (unit: IEvidenceUnit): boolean => unit.identity.join(".") === identity,
  );
  const unit: IEvidenceUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error(`Expected one JavaScript unit named ${identity}.`);
  return unit;
}
