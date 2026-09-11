---
name: benchmark
description: Defines Evidence benchmark workload integrity, parser/package footprint measurement, and reproducible result reporting. Use when running, changing, or publishing a benchmark; ordinary correctness tests do not require it.
---

# Benchmark

## Define The Measurement

Name the product revision, runtime, platform, hardware, corpus, supported language set, enabled policies, cache state, and measured phase. Separate config evaluation, discovery, parsing, resolution, graph evaluation, and output when attributing cost.

The scaffold has no performance harness or language adapters yet. Do not claim a parser benchmark or coverage result from package smoke tests. Add a benchmark only for an authorized measurement goal.

## Integrity

Measure the real product and the same complete workload across comparisons. A faster run that discovers fewer declarations, skips a reference, or loses failed files is not an optimization. Give each comparator its documented setup.

Keep cold start and warm reuse separate. Record repeated observations and variability rather than presenting the best sample alone. For watch tests include file creation/deletion and dependency invalidation, not just edits to an already-cached leaf.

Report compressed tarball size, unpacked package size, grammar assets, and the full dependency installation separately. Cite exact versions. A grammar-only footprint does not represent the required `typescript`/`ttsc` installation.

Treat a surprising result as a reason to inspect raw data and completeness before explaining it. Do not add fixture-specific branches, expected-answer checks, or benchmark-only restrictions that change ordinary product behavior.

## Artifacts And Reporting

Use a run-owned temporary directory, retain the requested reports, and clean only verified run-owned paths after their processes stop. Never recursively clean a shared package-manager or compiler cache.

Preserve commands, raw results, corpus identity, invalid samples, and limitations with the report. Publishing a result or uploading a dashboard requires the corresponding user authorization; measurement alone does not grant it. Use the issue-campaign workflow only when the user separately requests benchmark-driven implementation work.
