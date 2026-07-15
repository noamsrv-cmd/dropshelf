import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPathInside } from './pathSafety'

describe('isPathInside', () => {
  const root = path.resolve('C:/Users/example/AppData/DropShelf/captured')

  it('accepts a file below the managed directory', () => {
    expect(isPathInside(root, path.join(root, 'clipboard-safe.png'))).toBe(true)
  })

  it('rejects traversal, siblings, and the directory itself', () => {
    expect(isPathInside(root, path.join(root, '..', 'personal.png'))).toBe(false)
    expect(isPathInside(root, `${root}-backup/image.png`)).toBe(false)
    expect(isPathInside(root, root)).toBe(false)
  })
})
