import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'static/assets/full-sermons')
const out = join(root, 'static/assets/sermons-manifest.json')
const metaPath = join(root, 'scripts/sermons_metadata.json')

if (!existsSync(dir)) {
  console.warn('[manifest] static/assets/full-sermons/ not found — writing empty manifest')
  writeFileSync(out, '[]')
  process.exit(0)
}

// Load metadata for enrichment (keyed by slug = filename without .txt)
let metadata = {}
if (existsSync(metaPath)) {
  metadata = JSON.parse(readFileSync(metaPath, 'utf8'))
  console.log(`[manifest] loaded metadata for ${Object.keys(metadata).length} sermons`)
}

// Atomic topic vocabulary — derived by greedy decomposition of all topic strings in the metadata.
// Used to parse the space-concatenated topics field into an array of individual topic names.
const ATOMIC_TOPICS = [
  'Anxiety', 'Art and Beauty', 'Atonement', 'Christian Living and Obedience',
  'Christmas and Advent', 'Church Planting and Missions', 'Cities',
  'Communion and Baptism', 'Creation', 'Death', 'Discipleship and Spiritual Growth',
  'Doctrine', 'Easter', 'Family and Relationships', 'Forgiveness',
  'Fruit of the Spirit', 'Glorification', 'God the Father', "God's Love",
  'Heaven and Hell', 'Hope', 'Identity', 'Idolatry', "Jesus' Birth",
  "Jesus' Death & Resurrection", 'Justification', 'Lent', 'Marriage',
  'Mercy & Justice', 'Objections to Christianity', 'Prayer & Meditation',
  'Prophecy', 'Purpose and Calling', 'Race', 'Redemption', 'Repentance',
  'Rest & Sabbath', 'Restoration', 'Salvation', 'Sanctification', 'Sexuality',
  'Sharing Your Faith', 'Sin', 'Spiritual Gifts', 'Spiritual Warfare',
  'Stewardship, Generosity and Money', 'Suffering', 'The Bible',
  'The Church (Unity, Fellowship, Leadership)', 'The Fall', 'The Holy Spirit',
  'The Ten Commandments', 'Trust and Assurance', 'Understanding the Gospel',
  'Work & Faith', 'Worship',
]

function parseTopics(topicsStr) {
  if (!topicsStr || !topicsStr.trim()) return []
  const result = []
  let remaining = topicsStr.trim()
  while (remaining) {
    let matched = false
    for (const topic of ATOMIC_TOPICS) {
      if (remaining === topic) {
        result.push(topic)
        remaining = ''
        matched = true
        break
      }
      if (remaining.startsWith(topic + ' ')) {
        result.push(topic)
        remaining = remaining.slice(topic.length + 1)
        matched = true
        break
      }
    }
    if (!matched) {
      result.push(remaining)
      break
    }
  }
  return result
}

const files = readdirSync(dir).filter(f => f.endsWith('.txt')).sort()

if (files.length === 0) {
  console.warn('[manifest] No .txt files found in static/assets/full-sermons/ — writing empty manifest')
  writeFileSync(out, '[]')
  process.exit(0)
}

const manifest = files.map(f => {
  const slug = f.replace(/\.txt$/, '')
  const meta = metadata[slug] || {}

  const txt = readFileSync(join(dir, f), 'utf8').slice(0, 400)
  const title = meta.title || txt.match(/^TITLE:\s*(.+)/m)?.[1]?.trim() || slug.replace(/-/g, ' ')
  const url = meta.url || txt.match(/^URL:\s*(https?:\/\/\S+)/m)?.[1]?.trim() || null
  const topicList = parseTopics(meta.topics || '')

  return {
    file: f,
    title,
    url,
    topics: meta.topics || '',
    topicList,
    scripture: meta.scripture || '',
    series: meta.series || [],
    date: meta.date || '',
    duration: meta.duration || '',
  }
})

writeFileSync(out, JSON.stringify(manifest, null, 2))
console.log(`[manifest] ${manifest.length} sermons → static/assets/sermons-manifest.json`)
