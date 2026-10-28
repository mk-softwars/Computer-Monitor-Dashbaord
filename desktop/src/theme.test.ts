import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyTheme, DEFAULT_THEME, normalizeTheme, THEME_IDS } from './theme'

const here = dirname(fileURLToPath(import.meta.url))
const themeCss = readFileSync(join(here, 'themes.css'), 'utf8')
const stylesCss = readFileSync(join(here, 'styles.css'), 'utf8')

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

  it('keeps the 90s theme from animating or painting through a transparent window', () => {
    expect(themeCss).toMatch(/html\[data-theme="nineties"\],[\s\S]*background:\s*#c0c0c0\s*!important/)
    expect(themeCss).toMatch(/html\[data-theme="nineties"\] \.hardware-card,[\s\S]*overflow:\s*hidden/)
    expect(themeCss).toMatch(/html\[data-theme="nineties"\] \*,[\s\S]*animation:\s*none\s*!important/)
  })

  it('keeps Coding theme action buttons opaque so Windows can click them', () => {
    const block = themeCss.split('html[data-theme="coding"] .button {')[1]?.split('}')[0] ?? ''
    expect(block).toMatch(/background:\s*var\(--term-panel\)/)
    expect(block).not.toMatch(/background:\s*transparent/)
    expect(themeCss).toMatch(/html\[data-theme="coding"\] \.mode-switch button,[\s\S]*background:\s*var\(--term-panel\)/)
    expect(themeCss).toMatch(/html\[data-theme="coding"\],[\s\S]*background:\s*#050805\s*!important/)
  })

  it('keeps Appearance nav buttons opaque and outside the dashboard drag region', () => {
    expect(stylesCss).toMatch(/\.app \{[\s\S]*-webkit-app-region:\s*no-drag/)
    expect(stylesCss).toMatch(/\.settings-nav button \{[\s\S]*background:\s*#0d0b25/)
    expect(stylesCss).not.toMatch(/\.settings-nav button \{[^}]*background:\s*transparent/)
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
