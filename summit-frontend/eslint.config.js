// Reglas de ESLint del frontend (npm run lint): las recomendadas de JavaScript y de los hooks de React.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // "const { a, b, ...resto } = x" para sacarle campos a un objeto: a y b no se usan a propósito
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    // Archivos que corren en Node (configuración de Vite y de ESLint)
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
