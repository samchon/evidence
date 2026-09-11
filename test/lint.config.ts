import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  extends: "../config/lint.config.ts",
  plugins: { evidence },
} satisfies ITtscLintConfig;
