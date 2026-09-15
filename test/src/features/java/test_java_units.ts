import { EvidenceJavaAdapter, EvidenceLanguageRegistry } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies Java public types, overloads, fields, records, enums, and
 * annotations.
 *
 * The selected surface must retain all public forms and their lexical
 * ownership.
 *
 * 1. Analyze the declared Java forms.
 * 2. Compare symbols and identities.
 * 3. Verify overloads and owned members retain sites.
 */
export async function test_java_units(): Promise<void> {
  // Certified metadata publishes the exact upstream grammar version and source boundary.
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "java",
  );
  if (language === undefined)
    throw new Error("Missing Java language metadata.");
  if (language.adapter === undefined)
    throw new Error("Missing Java adapter metadata.");
  TestValidator.equals(
    "certified Java adapter",
    language.adapter.entry,
    "EvidenceJavaAdapter",
  );
  TestValidator.equals(
    "published Java grammar version",
    language.adapter.publicSurface.includes("tree-sitter-java v0.23.5"),
    true,
  );

  // Separate source files share a package identity without importing or executing Java.
  const inventory = await new EvidenceJavaAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/com/example/Sale.java",
        dedent`
          package com.example /* package comments do not erase identity */;

          @Deprecated
          public class Sale {
              public int total;
              public static final String FIRST = "first", SECOND = "second";
              protected int protectedValue;
              int packageValue;
              private int privateValue;

              public Sale() {}
              public int calculate() { return 0; }
              public int calculate(int value) { return value; }
              protected void protectedMethod() {}

              public static class Nested {
                  public void open() {}
              }
              static class PackageNested {
                  public void hidden() {}
              }
              private static class PrivateNested {}
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/com/example/Service.java",
        dedent`
          package com.example;

          public interface Service {
              int LIMIT = 1;
              void run();
              default void start() {}
              static void open() {}
              private void hidden() {}

              class Nested {
                  public void nestedMethod() {}
              }

              interface Child {
                  void child();
              }
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/com/example/State.java",
        dedent`
          package com.example;

          public enum State {
              READY,
              FAILED(1);

              State() {}
              State(int code) {}
              public int code() { return 0; }
              private void hidden() {}
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/com/example/Point.java",
        dedent`
          package com.example;

          public record Point(int x, @Deprecated int y, String... tags) {
              public int distance() { return x + y; }
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/com/example/Label.java",
        dedent`
          package com.example;

          public @interface Label {
              String value();
              int count() default 0;

              enum Kind {
                  DEFAULT
              }
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/com/example/PackageType.java",
        dedent`
          package com.example;

          class PackageType {
              public void hidden() {}
          }
        `,
      ),
    ]),
  );

  // Context defaults expose interface members while private and package members stay absent.
  TestValidator.equals("complete Java units", inventory.diagnostics, []);
  TestValidator.equals(
    "Java declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:com.example.Point.distance",
      "function:com.example.Sale.Nested.open",
      "function:com.example.Sale.calculate",
      "function:com.example.Service.Child.child",
      "function:com.example.Service.Nested.nestedMethod",
      "function:com.example.Service.open",
      "function:com.example.Service.run",
      "function:com.example.Service.start",
      "function:com.example.State.code",
      "property:com.example.Label.Kind.DEFAULT",
      "property:com.example.Label.count",
      "property:com.example.Label.value",
      "property:com.example.Point.x",
      "property:com.example.Point.y",
      "property:com.example.Point.tags",
      "property:com.example.Sale.FIRST",
      "property:com.example.Sale.SECOND",
      "property:com.example.Sale.total",
      "property:com.example.Service.LIMIT",
      "property:com.example.State.FAILED",
      "property:com.example.State.READY",
      "type:com.example.Label",
      "type:com.example.Label.Kind",
      "type:com.example.Point",
      "type:com.example.Sale",
      "type:com.example.Sale.Nested",
      "type:com.example.Service",
      "type:com.example.Service.Child",
      "type:com.example.Service.Nested",
      "type:com.example.State",
    ].sort(compare),
  );

  const overload = inventory.units.find(
    (unit) => unit.identity.join(".") === "com.example.Sale.calculate",
  );
  if (overload === undefined) throw new Error("Missing Java overload family.");
  TestValidator.equals(
    "Java overload declaration sites",
    overload.sites.length,
    2,
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
