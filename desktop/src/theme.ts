export const THEME_IDS = ['rgb', 'nineties', 'coding'] as const

export type AppTheme = (typeof THEME_IDS)[number]

export const DEFAULT_THEME: AppTheme = 'rgb'

export const THEME_OPTIONS: ReadonlyArray<{
  id: AppTheme
  name: string
  description: string
}> = [
  {
    id: 'rgb',
    name: 'Original RGB',
    description: 'The current neon dashboard',
  },
  {
    id: 'nineties',
    name: '90s',
    description: 'Classic Windows gray workstation',
  },
  {
    id: 'coding',
    name: 'Coding',
    description: 'Black-and-green terminal monitor',
  },
]

export function normalizeTheme(value: unknown): AppTheme {
  return THEME_IDS.includes(value as AppTheme) ? (value as AppTheme) : DEFAULT_THEME
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('computer-monitor-settings')
    const parsed = stored ? JSON.parse(stored) as { theme?: unknown } : null
    applyTheme(normalizeTheme(parsed?.theme))
  } catch {
    applyTheme(DEFAULT_THEME)
  }
}

export function subscribeThemeSync() {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'computer-monitor-settings' || !event.newValue) return
    try {
      applyTheme(normalizeTheme((JSON.parse(event.newValue) as { theme?: unknown }).theme))
    } catch {
      applyTheme(DEFAULT_THEME)
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
