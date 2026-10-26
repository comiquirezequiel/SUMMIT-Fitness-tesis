// Reglas de ESLint del frontend (npm run lint). Las de la plantilla de Vite + React, con algunos ajustes al proyecto.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    // El proyecto importa React en cada archivo con JSX (aunque el JSX nuevo no lo necesite): cuenta como usado
    'react/jsx-uses-react': 'error',
    // "const { a, b, ...resto } = x" para sacarle campos a un objeto: a y b no se usan a propósito
    'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    // Los componentes no declaran prop-types (el proyecto no los usa)
    'react/prop-types': 'off',
    // Los enlaces externos ya llevan rel="noopener noreferrer" donde hace falta
    'react/jsx-no-target-blank': 'off',
    // Comillas y apóstrofos en los textos de las pantallas: se ven bien tal cual
    'react/no-unescaped-entities': 'off',
    // Solo afecta la recarga en caliente al desarrollar: varios archivos exportan a propósito componentes y funciones
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    {
      // Archivos que corren en Node (configuración de Vite y Tailwind) y el service worker
      files: ['vite.config.js', 'tailwind.config.js', 'postcss.config.js'],
      env: { node: true, browser: false },
    },
    {
      files: ['public/sw.js', 'src/sw.js'],
      env: { serviceworker: true, browser: false },
    },
  ],
};
