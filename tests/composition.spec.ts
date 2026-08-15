import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

describe('Cordis composition', () => {
  it('mounts all host rows with a mock subagent provider', async () => {
    const fixture = fileURLToPath(new URL('./fixtures/composition-smoke.ts', import.meta.url))
    const result = await runLoaderSmoke({
      label: 'antfarm composition smoke',
      tempDirPrefix: 'antfarm-composition-',
      binScript: fixture,
      libBinScript: fixture,
      configPath: fixture,
      binArgs: [],
      tsconfigPath: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
      mode: 'lib',
    })

    expect(result.stdout).toBe('antfarm composition mounted and disposed\n')
    expect(result.stderr).toBe('')
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
