import assert from "node:assert/strict";

import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";
import type { AdapterCertificationMutationKind } from "../../internal/certification/AdapterCertificationMutationKind";
import type { IAdapterCertification } from "../../internal/certification/IAdapterCertification";
import { TestCertificationAdapter } from "../../internal/certification/TestCertificationAdapter";

/** Proves the shared harness rejects removed units, wrong kinds, detached hosts, and broken aliases. */
export async function test_adapter_certification_integrity(): Promise<void> {
  const original = AdapterCertificationFixtures.all()[0];
  if (original === undefined)
    throw new Error("The certification catalog is empty.");

  // A minimal adapter can enter the harness without any graph-policy changes.
  const valid: IAdapterCertification = {
    ...original,
    adapter: new TestCertificationAdapter(original.adapter, "none"),
  };
  AdapterCertification.assertInventory(
    valid,
    await AdapterCertification.analyze(valid),
  );

  // Every declared conformance dimension independently rejects a damaged result.
  const mutations: AdapterCertificationMutationKind[] = [
    "unit",
    "kind",
    "host",
    "alias",
  ];
  for (const mutation of mutations) {
    const invalid: IAdapterCertification = {
      ...original,
      adapter: new TestCertificationAdapter(original.adapter, mutation),
    };
    const inventory = await AdapterCertification.analyze(invalid);
    assert.throws(
      () => AdapterCertification.assertInventory(invalid, inventory),
      `Certification accepted an intentional ${mutation} defect.`,
    );
  }
}
