import { EvidJavaAdapter } from "evid";
import type { IEvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Reports Java parse and identity uncertainty without publishing a partial
 * surface.
 *
 * Source-only analysis must retain failures when parsing or declaration
 * identity is uncertain.
 *
 * 1. Analyze uncertain Java source.
 * 2. Require incompleteness and diagnostics.
 * 3. Preserve source-boundary behavior.
 */
export async function test_java_failures(): Promise<void> {
  const adapter = new EvidJavaAdapter();

  // Two selected sources cannot own the same package declaration identity.
  const duplicateType = await adapter.analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create(
        "src/first/Sale.java",
        "package com.example; public class Sale {}\n",
      ),
      EvidTestSourceSnapshot.create(
        "src/second/Sale.java",
        "package com.example; public class Sale {}\n",
      ),
    ]),
  );
  TestValidator.equals("duplicate Java type", duplicateType.complete, false);
  TestValidator.equals(
    "duplicate Java type diagnostic",
    hasCode(duplicateType, "java-declaration-conflict"),
    true,
  );

  // Java's field and method namespaces can legally share one accessor spelling.
  const disjointNamespaces = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Conflict.java",
      dedent`
        public class Conflict {
            public int value;
            public int value() { return value; }
        }
      `,
    ),
  );
  TestValidator.equals(
    "Java disjoint member namespaces",
    disjointNamespaces.complete,
    true,
  );
  TestValidator.equals(
    "Java disjoint member symbols",
    disjointNamespaces.units
      .filter((unit) => unit.name === "value")
      .map((unit) => unit.symbol)
      .sort(compare),
    ["function", "property"],
  );

  // JPMS descriptors do not restrict the source-public contract.
  const moduleDescriptor = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/module-info.java",
      dedent`
        module com.example.application {
            exports com.example.api;
            requires java.base;
        }
      ` + "\n",
    ),
  );
  TestValidator.equals(
    "Java module descriptor diagnostics",
    moduleDescriptor.diagnostics,
    [],
  );
  TestValidator.equals(
    "Java module descriptor units",
    moduleDescriptor.units,
    [],
  );
  TestValidator.equals(
    "Java module descriptor completeness",
    moduleDescriptor.complete,
    true,
  );

  // An annotation processor is never executed; only explicit selected source is inventoried.
  const generatedBoundary = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Model.java",
      dedent`
        @GenerateBuilder
        public class Model {
            public int id;
        }
      `,
    ),
  );
  TestValidator.equals(
    "annotated Java source diagnostics",
    generatedBoundary.diagnostics,
    [],
  );
  TestValidator.equals(
    "explicit annotated Java declarations",
    generatedBoundary.units
      .map((unit) => unit.identity.join("."))
      .sort(compare),
    ["Model", "Model.id"],
  );

  // Tree-sitter syntax errors never become a healthy partial inventory.
  const malformed = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Broken.java",
      "public class Broken { public void run( { }\n",
    ),
  );
  TestValidator.equals("malformed Java source", malformed.complete, false);
  TestValidator.equals(
    "Java parse diagnostic",
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith("java-parse-"),
    ),
    true,
  );
}

function hasCode(inventory: IEvidInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
