#!/usr/bin/env node
import { EvidenceCommand } from "../commands/EvidenceCommand.js";

EvidenceCommand.main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 2;
  });
