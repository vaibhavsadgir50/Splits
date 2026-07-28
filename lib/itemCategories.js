// Fixed category enum — kept in sync with the Gemini receipt-parsing prompt.
export const ITEM_CATEGORIES = [
  'produce',
  'dairy_eggs',
  'meat_seafood',
  'bakery',
  'beverages',
  'snacks',
  'frozen',
  'alcohol',
  'household',
  'personal_care',
  'pantry',
  'other',
]

const ICONS = {
  produce: 'nutrition',
  dairy_eggs: 'egg',
  meat_seafood: 'set_meal',
  bakery: 'bakery_dining',
  beverages: 'local_cafe',
  snacks: 'cookie',
  frozen: 'ac_unit',
  alcohol: 'liquor',
  household: 'cleaning_services',
  personal_care: 'spa',
  pantry: 'kitchen',
  other: 'shopping_bag',
}

const COLORS = {
  produce: '#22c55e',
  dairy_eggs: '#eab308',
  meat_seafood: '#ef4444',
  bakery: '#d97706',
  beverages: '#0ea5e9',
  snacks: '#f97316',
  frozen: '#38bdf8',
  alcohol: '#a855f7',
  household: '#14b8a6',
  personal_care: '#ec4899',
  pantry: '#84cc16',
  other: '#6b7280',
}

export function categoryIcon(category) {
  return ICONS[category] || ICONS.other
}

export function categoryColor(category) {
  return COLORS[category] || COLORS.other
}
