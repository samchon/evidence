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
  importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["decorators-legacy", "typescript", "jsx"],

  overrides: [
    {
      files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
      options: { parser: "typescript" },
    },
    {
      files: ["*.md", "*.mdx"],
      options: {
        proseWrap: "never",
        embeddedLanguageFormatting: "off",
      },
    },
  ],
};
