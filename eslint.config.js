import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname, // optional; default: process.cwd()
  resolvePluginsRelativeTo: __dirname, // optional
  recommendedConfig: js.configs.recommended, // optional
  allConfig: js.configs.all, // optional
})

export default [
  {
    files: [`./src`, `./tests` ]
  },
  stylistic.configs.customize({
    indent: 2,
    semi: false,
    quoteProps: `consistent-as-needed`,
  }),
  ...compat.extends(`plugin:@typescript-eslint/recommended`, `plugin:expect-type/recommended`),
  ...compat.plugins(`@typescript-eslint`, `simple-import-sort`, `unused-imports`, `disable-autofix`, `expect-type`),
  ...compat.config({
    parserOptions: {
      "parser": {
          "ts": "@typescript-eslint/parser",
          "js": "@typescript-eslint/parser",
          "<template>": "espree"
      },
      project: 'tsconfig.json',
      sourceType: 'module'
    },
    rules: {
      'no-void': 0,
      'no-unused-vars': `off`, // or "@typescript-eslint/no-unused-vars": "off",
      '@typescript-eslint/no-unused-vars': `off`,
      'unused-imports/no-unused-vars': `off`,
      '@stylistic/yield-star-spacing': [`error`, { before: false, after: true }],
      '@stylistic/member-delimiter-style': `off`,
      '@typescript-eslint/no-unused-vars': `off`,
      '@typescript-eslint/no-explicit-any': `off`,
      '@typescript-eslint/semi': [`error`, `never`],
      '@typescript-eslint/ban-ts-comment': 0,
      '@typescript-eslint/ban-types': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/prefer-includes': 0,
      '@typescript-eslint/return-await': 0,
      '@typescript-eslint/member-delimiter-style': [
        `error`,
        {
          multiline: {
            delimiter: `none`,
            requireLast: true,
          },
          singleline: {
            delimiter: `semi`,
            requireLast: false,
          },
        },
      ],
      'indent': `off`,
      '@typescript-eslint/restrict-template-expressions': `off`,
      '@typescript-eslint/space-before-function-paren': `off`,
      '@typescript-eslint/indent': `off`,
      '@typescript-eslint/explicit-function-return-type': `off`,
      '@typescript-eslint/no-empty-interface': `off`,
      '@typescript-eslint/adjacent-overload-signatures': `error`,
      '@typescript-eslint/array-type': `error`,
      '@typescript-eslint/consistent-type-definitions': [`error`, `interface`],
      '@typescript-eslint/no-inferrable-types': `error`,
      '@typescript-eslint/no-misused-new': `error`,
      '@typescript-eslint/no-this-alias': `error`,
      '@typescript-eslint/prefer-for-of': `error`,
      '@typescript-eslint/prefer-function-type': `error`,
      '@typescript-eslint/prefer-namespace-keyword': `error`,
      '@typescript-eslint/quotes': [
        `error`,
        `backtick`,
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
      '@typescript-eslint/triple-slash-reference': `error`,
      '@typescript-eslint/type-annotation-spacing': `error`,
      '@typescript-eslint/unified-signatures': `error`,
      'dot-notation': `error`,
      'linebreak-style': [`error`, `unix`],
      'new-parens': `error`,
      'no-caller': `error`,
      'no-duplicate-case': `error`,
      'no-duplicate-imports': `error`,
      'no-empty': `error`,
      'no-eval': `error`,
      'no-extra-bind': `error`,
      'no-fallthrough': `error`,
      'no-new-func': `error`,
      'no-new-wrappers': `error`,
      'no-return-await': `error`,
      'no-sparse-arrays': `error`,
      'no-template-curly-in-string': `error`,
      'no-throw-literal': `error`,
      'no-trailing-spaces': `error`,
      'no-undef-init': `error`,
      'no-unsafe-finally': `error`,
      'no-unused-expressions': [`error`, { allowTernary: true }],
      'no-unused-labels': `error`,
      'no-var': `error`,
      'object-shorthand': `error`,
      'prefer-const': `error`,
      'prefer-object-spread': `error`,
      'space-in-parens': `error`,
      'unicode-bom': [`error`, `never`],
      'use-isnan': `error`,
      'import/no-absolute-path': `off`,
      'disable-autofix/unused-imports/no-unused-imports': `off`,
      'simple-import-sort/imports': [
        `error`,
        {
          groups: [
            [`^effect/.+`, `^@?\\w`],
            // Internal packages.
            [`^(@|components)(/.*|$)`],
            // Parent imports. Put `..` last.
            [`^\\.\\.(?!/?$)`, `^\\.\\./?$`],
            // Other relative imports. Put same-folder imports and `.` last.
            [`^\\./(?=.*/)(?!/?$)`, `^\\.(?!/?$)`, `^\\./?$`],
            // Style imports.
            [`^.+\\.?(css)$`],
            // Side effect imports.
            [`^\\u0000`],
          ],
        },
      ],
    },
  }),
  {
    ignores: [`**/*.js`, `node_modules/**/*`, `**/*.d.ts`]
  }
]
