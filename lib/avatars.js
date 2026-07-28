const PALETTE = [
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#d946ef', // fuchsia
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function avatarColor(name) {
  if (!name) return PALETTE[0]
  return PALETTE[hashString(name) % PALETTE.length]
}

export function initials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

// Local Memoji set (public/memoji), sorted by presentation so we can pick a
// gender-appropriate character when we know it. Older-looking faces (gray hair,
// gray mustache) are deliberately excluded — every character should read young.
const MALE_MEMOJIS = [
  'Memoji-02.png', 'Memoji-03.png', 'Memoji-04.png', 'Memoji-05.png',
  'Memoji-07.png', 'Memoji-09.png', 'Memoji-10.png', 'Memoji-12.png', 'Memoji-13.png',
  'Memoji-18.png', 'Memoji-23.png', 'Memoji-24.png',
]
const FEMALE_MEMOJIS = [
  'Memoji-06.png', 'Memoji-08.png', 'Memoji-11.png', 'Memoji-14.png', 'Memoji-15.png',
  'Memoji-16.png', 'Memoji-17.png', 'Memoji-19.png', 'Memoji-20.png', 'Memoji-22.png',
  'Memoji-25.png', 'Memoji-26.png',
]
const ALL_MEMOJIS = [...MALE_MEMOJIS, ...FEMALE_MEMOJIS]

// Known genders for this household's test members — used to pick a matching
// character. Anyone not listed here gets a deterministic pick from the full set.
const KNOWN_GENDER = {
  prem: 'male',
  faraz: 'male',
  hari: 'male',
  likhit: 'male',
  priyanka: 'female',
  rajeshri: 'female',
  rajshri: 'female',
}

// Deterministic cartoon avatar — same name always gets the same character.
export function cartoonAvatarUrl(name) {
  const key = (name || '').trim().toLowerCase()
  const gender = KNOWN_GENDER[key]
  const pool = gender === 'male' ? MALE_MEMOJIS : gender === 'female' ? FEMALE_MEMOJIS : ALL_MEMOJIS
  const file = pool[hashString(name) % pool.length]
  return `/memoji/${file}`
}
