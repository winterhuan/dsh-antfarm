import { defineConfig } from 'vitest/config'
import ts from 'typescript'

export default defineConfig({
  plugins: [{
    name: 'antfarm-standard-decorators',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?', 1)[0]
      if (file === undefined || !/\.[cm]?tsx?$/.test(file) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
      return ts.transpileModule(code, {
        fileName: file,
        compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText
    },
  }],
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
    pool: 'forks',
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [],
  },
})
