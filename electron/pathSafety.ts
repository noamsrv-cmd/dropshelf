import path from 'node:path'

/** Return true only when candidate resolves to a descendant of parent. */
export function isPathInside(parent: string, candidate: string): boolean {
  if (!parent || !candidate) return false
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
}
