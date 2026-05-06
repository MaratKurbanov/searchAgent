import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'static/assets/full-sermons')
const out = join(root, 'static/assets/sermons-manifest.json')

if (!existsSync(dir)) {
  console.warn('[manifest] static/assets/full-sermons/ not found — writing empty manifest')
  writeFileSync(out, '[]')
  process.exit(0)
}

const files = readdirSync(dir).filter(f => f.endsWith('.txt')).sort()

if (files.length === 0) {
  console.warn('[manifest] No .txt files found in static/assets/full-sermons/ — writing empty manifest')
  writeFileSync(out, '[]')
  process.exit(0)
}

const manifest = files.map(f => {
  const txt = readFileSync(join(dir, f), 'utf8').slice(0, 400)
  const title = txt.match(/^TITLE:\s*(.+)/m)?.[1]?.trim() || f.replace(/\.txt$/, '').replace(/-/g, ' ')
  const url = txt.match(/^URL:\s*(https?:\/\/\S+)/m)?.[1]?.trim() || null
  return { file: f, title, url }
})

writeFileSync(out, JSON.stringify(manifest, null, 2))
console.log(`[manifest] ${manifest.length} sermons → static/assets/sermons-manifest.json`)
