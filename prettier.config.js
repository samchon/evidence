module.exports = {
  // DEFAULT CONFIGURATIONS
  printWidth: 80,
  semi: true,
  tabWidth: 2,
  trailingComma: "all",

  // PLUG-IN CONFIGURATIONS
  plugins: [
    require.resolve("@trivago/prettier-plugin-sort-imports"),
    require.resolve("prettier-plugin-jsdoc"),
  ],
  importOrder: ["<THIRD_PARTY_MODULES>", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["decorators-legacy", "typescript"],

  overrides: [
    {
      files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
      options: { parser: "typescript" },
    },
    // Markdown: prose soft-wraps on render, so a manual mid-paragraph line
    // break changes nothing visible and only makes diffs noisy. Keep each
    // paragraph on one source line. This is the mechanical enforcement of the
    // no-hard-wrap rule that AGENTS.md and the wiki skill both state.
    // `embeddedLanguageFormatting: "off"` keeps fenced code blocks
    // byte-identical.
    {
      files: ["*.md"],
      options: {
        proseWrap: "never",
        embeddedLanguageFormatting: "off",
      },
    },
  ],
};
