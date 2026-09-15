#!/usr/bin/env node
import { EvidenceCommand } from "../commands/EvidenceCommand.js";

// Keep process termination outside the reusable command module. Assigning the
// exit code lets pending stream writes and watcher cleanup complete naturally.
EvidenceCommand.main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 2;
  });
