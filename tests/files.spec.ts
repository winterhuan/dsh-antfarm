import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { captureFileInputs, createFileWorkspace, fileCandidateVersion, fileWorkspacePath, retainFileOutputs, validateFileWorkspace } from '../src/workspace/files.ts'

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-files-')))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  return root
}

describe('non-Git input and output ownership', () => {
  it('uses admission snapshots while preserving input files and retained output versions', async () => {
    const root = await fixture(); await writeFile(join(root, 'research.txt'), 'accepted input')
    const inputs = await captureFileInputs(root, ['research.txt'])
    await writeFile(join(root, 'research.txt'), 'later input')
    const workspace = fileWorkspacePath(root, 'af-files')
    await createFileWorkspace(workspace, 'af-files', inputs)
    await validateFileWorkspace(workspace, 'af-files')
    expect(await readFile(join(workspace, 'inputs/research.txt'), 'utf8')).toBe('accepted input')
    expect(await readFile(join(root, 'research.txt'), 'utf8')).toBe('later input')
    await writeFile(join(workspace, 'report.md'), 'Version one')
    const first = await fileCandidateVersion(workspace)
    const destination = join(root, 'evidence')
    const artifacts = await retainFileOutputs(workspace, destination)
    await writeFile(join(workspace, 'report.md'), 'Version two')
    expect(await fileCandidateVersion(workspace)).not.toBe(first)
    expect(artifacts).toHaveLength(1)
    expect(await readFile(join(destination, artifacts[0]!.sha256), 'utf8')).toBe('Version one')
  })

  it('refuses outside input paths, escaped links and mismatched owners', async () => {
    const root = await fixture(); const project = join(root, 'project'); await mkdir(project)
    await writeFile(join(root, 'outside.txt'), 'outside')
    await expect(captureFileInputs(project, ['../outside.txt'])).rejects.toThrow('escapes')
    await symlink(join(root, 'outside.txt'), join(project, 'linked.txt'))
    await expect(captureFileInputs(project, ['linked.txt'])).rejects.toThrow('escapes')
    const workspace = fileWorkspacePath(project, 'af-files')
    await createFileWorkspace(workspace, 'af-files', [])
    await expect(validateFileWorkspace(workspace, 'af-other')).rejects.toThrow('ownership')
    await symlink(join(root, 'outside.txt'), join(workspace, 'output.md'))
    await expect(retainFileOutputs(workspace, join(root, 'evidence'))).rejects.toThrow('symbolic links')
  })
})
