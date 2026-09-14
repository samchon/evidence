import { EvidencePhpAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Prevents runtime-dependent PHP declarations and malformed input from becoming a smaller passing inventory. */
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
    "<?php eval($code);",
    "<?php spl_autoload_register($loader);",
    "<?php class Broken {",
  ]) {
    const inventory = await new EvidencePhpAdapter().analyze(
      TestSourceSnapshot.create("src/boundary.php", source),
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
  const conflict = await new EvidencePhpAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/one.php",
        "<?php namespace App; class Contract {}",
      ),
      TestSourceSnapshot.create(
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

  const sourceFailure = TestSourceSnapshot.create(
    "src/missing.php",
    "<?php class Contract {}",
  );
  sourceFailure.complete = false;
  sourceFailure.diagnostics.push({
    code: "file-unreadable",
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
