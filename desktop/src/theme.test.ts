import { applyTheme, DEFAULT_THEME, normalizeTheme, THEME_IDS } from './theme'

describe('theme system', () => {
  afterEach(() => {
    document.documentElement.dataset.theme = DEFAULT_THEME
  })

  it('defaults to Original RGB and recovers invalid values', () => {
    expect(DEFAULT_THEME).toBe('rgb')
    expect(normalizeTheme(undefined)).toBe('rgb')
    expect(normalizeTheme('')).toBe('rgb')
    expect(normalizeTheme('neon')).toBe('rgb')
    expect(normalizeTheme('nineties')).toBe('nineties')
    expect(normalizeTheme('coding')).toBe('coding')
    expect(THEME_IDS).toEqual(['rgb', 'nineties', 'coding'])
  })

  it('applies the selected theme on the document without a restart', () => {
    applyTheme('coding')
    expect(document.documentElement.dataset.theme).toBe('coding')
    applyTheme('nineties')
    expect(document.documentElement.dataset.theme).toBe('nineties')
    applyTheme('rgb')
    expect(document.documentElement.dataset.theme).toBe('rgb')
  })
})
