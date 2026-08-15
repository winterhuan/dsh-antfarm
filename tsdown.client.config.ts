import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'tsdown'

const id = 'dsh-antfarm'
const externals = [
  'react',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
]

export default defineConfig({
  name: `${id}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: externals,
    alwaysBundle: source => externals.includes(source) ? undefined : true,
  },
  plugins: [{
    name: 'antfarm-css-text',
    resolveId(source, importer) {
      if (!source.endsWith('.css') || importer === undefined) return null
      return `\0antfarm-css:${resolve(dirname(importer), source)}.mjs`
    },
    async load(source) {
      if (!source.startsWith('\0antfarm-css:')) return null
      const path = source.slice('\0antfarm-css:'.length, -'.mjs'.length).replace('/lib/types/client/', '/src/client/')
      this.addWatchFile(path)
      return `export default ${JSON.stringify(await readFile(path, 'utf8'))}`
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
