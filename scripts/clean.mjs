import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedDirectories = ['dist', 'dist-electron']

for (const directory of generatedDirectories) {
  const target = path.resolve(root, directory)
  if (path.dirname(target) !== root || path.basename(target) !== directory) {
    throw new Error(`Refusing to clean unexpected path: ${target}`)
  }
  await rm(target, { recursive: true, force: true })
}
