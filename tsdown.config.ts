import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'lib',
  format: ['esm'] as const,
  platform: 'node' as const,
  target: 'es2024' as const,
  fixedExtension: false,
  dts: false,
  clean: false,
}

export default defineConfig([
  { ...shared, entry: { index: 'lib/types/index.js' } },
  { ...shared, entry: { runtime: 'lib/types/runtime/index.js' } },
  { ...shared, entry: { tool: 'lib/types/tool/index.js' } },
  { ...shared, entry: { commands: 'lib/types/commands/index.js' } },
  { ...shared, entry: { 'studio-host': 'lib/types/studio-host/index.js' } },
  { ...shared, entry: { invariant: 'lib/types/invariant.js' } },
])
