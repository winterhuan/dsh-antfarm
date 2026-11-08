import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'lib/types/index.js', runtime: 'lib/types/runtime/index.js', tool: 'lib/types/tool/index.js', commands: 'lib/types/commands/index.js', 'studio-host': 'lib/types/studio-host/index.js' },
  outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024',
  fixedExtension: false, dts: false, clean: false,
})
