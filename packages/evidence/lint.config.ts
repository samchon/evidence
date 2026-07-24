import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence } from "./lib/index.js";

export default {
  plugins: {
    evidence: evidence,
  },
  rules: {
    "evidence/singular": "error",
    "evidence/documented": "error",
  },
} satisfies ITtscLintConfig;
