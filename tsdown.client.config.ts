import { clientBundle } from './scripts/tsdown.client.ts'
import { fileURLToPath } from 'node:url'

const bundle = clientBundle(import.meta.dirname, [], { hostPhase: true })
const browserYaml = fileURLToPath(new URL('./browser/index.js', import.meta.resolve('yaml/package.json')))

export default (options: Parameters<typeof bundle>[0]) => bundle(options).map(config => config.platform === 'browser'
  ? { ...config, alias: { ...config.alias, yaml: browserYaml } }
  : config)
