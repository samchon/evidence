import { EvidencePhpAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects PHP inputs whose declaration population is not statically knowable.
 *
 * Runtime-dependent declarations, malformed syntax, conflicts, and failed
 * sources must remain incomplete.
 *
 * 1. Analyze dynamic, unsupported, and malformed PHP sources.
 * 2. Require incomplete results with relevant diagnostics.
 * 3. Verify source failure cannot pass.
 */
export async function test_php_boundaries(): Promise<void> {
  for (const source of [
    "class Tagless {}",
    "<?php if ($flag) { class Conditional {} }",
    "<?php function outer() { function nested() {} }",
    "<?php trait A { function run() {} } class B { use A; }",
    "<?php trait A { function run() {} } trait B { function run() {} } class C { use A, B { A::run insteadof B; B::run as private hidden; } }",
    "<?php require 'contract.php';",
    "<?php function load() { include_once $path; }",
    "<?php class_alias('Source', 'Alias');",
    "<?php define('RUNTIME', 1);",
    "<?php use function define as publish; publish('RUNTIME', 1);",
    "<?php eval($code);",
    "<?php spl_autoload_register($loader);",
    "<?php class Dynamic { function run() { $this->added = 1; } }",
    "<?php class Dynamic { function run() { $this->added[] = 1; } }",
    "<?php class Dynamic { function run($name) { $this->$name = 1; } }",
    "<?php class Broken {",
    "<?php class Emoji { public int $\ud83d\ude00 = 1; }",
  ]) {
    const inventory = await new EvidencePhpAdapter().analyze(
      EvidenceTestSourceSnapshot.create("src/boundary.php", source),
    );

    TestValidator.equals(source, inventory.complete, false);
    TestValidator.predicate(
      "actionable diagnostics",
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.repair.length !== 0,
      ),
    );
  }
  for (const file of ["contract.PHP", "contract.phtml", "contract.inc"]) {
    const unsupported = await new EvidencePhpAdapter().analyze(
      EvidenceTestSourceSnapshot.create(file, "<?php class Contract {}"),
    );
    TestValidator.equals(
      "unadvertised source spelling is rejected",
      unsupported.complete,
      false,
    );
    TestValidator.predicate(
      "extension repair is actionable",
      unsupported.diagnostics.some(
        (diagnostic) => diagnostic.code === "php-unsupported-extension",
      ),
    );
  }
  const grouped = await new EvidencePhpAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "grouped.php",
      "<?php use Vendor\\{function define as publish}; function run() { publish(); }",
    ),
  );
  TestValidator.equals(
    "namespaced import is not a global runtime builtin",
    grouped.complete,
    true,
  );
  const declared = await new EvidencePhpAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "declared.php",
      "<?php class Explicit { private int $value = 0; function update() { $this->value = 1; } function read() { return $this->external; } }",
    ),
  );
  TestValidator.equals(
    "declared property mutation and reads do not invent public fields",
    declared.complete,
    true,
  );
  const conflict = await new EvidencePhpAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/one.php",
        "<?php namespace App; class Contract {}",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/two.php",
        "<?php namespace app; class contract {}",
      ),
    ]),
  );
  TestValidator.equals(
    "PHP type identities are case insensitive",
    conflict.complete,
    false,
  );
  TestValidator.predicate(
    "duplicate declarations are not overloads",
    conflict.diagnostics.some(
      (diagnostic) => diagnostic.code === "php-declaration-conflict",
    ),
  );

  const sourceFailure = EvidenceTestSourceSnapshot.create(
    "src/missing.php",
    "<?php class Contract {}",
  );
  sourceFailure.complete = false;
  sourceFailure.diagnostics.push({
    code: "path-unreadable",
    path: "/project/src/missing.php",
    message: "Read denied",
  });
  const failed = await new EvidencePhpAdapter().analyze(sourceFailure);
  TestValidator.equals("source failure retained", failed.complete, false);
  TestValidator.predicate(
    "source diagnostic retained",
    failed.diagnostics.some(
      (diagnostic) => diagnostic.message === "Read denied",
    ),
  );
}
