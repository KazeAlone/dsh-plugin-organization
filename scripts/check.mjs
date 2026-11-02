import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) check(path)
    else if (path.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' })
      if (result.status !== 0) process.exit(result.status || 1)
    }
  }
}
for (const directory of ['src', 'templates', 'test', 'examples', 'scripts']) check(directory)
console.log('All JavaScript modules passed syntax checks.')
