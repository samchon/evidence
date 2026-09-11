#!/usr/bin/env node
import { EvidenceCommand } from "../EvidenceCommand.js";

EvidenceCommand.main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
