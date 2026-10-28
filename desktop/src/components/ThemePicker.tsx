import { useRef } from 'react'
import { THEME_OPTIONS, type AppTheme } from '../theme'

interface ThemePickerProps {
  value: AppTheme
  onChange(theme: AppTheme): void
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  const move = (index: number) => {
    const next = THEME_OPTIONS[(index + THEME_OPTIONS.length) % THEME_OPTIONS.length]
    onChange(next.id)
    buttons.current[THEME_OPTIONS.findIndex(item => item.id === next.id)]?.focus()
  }

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((option, index) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.name}
            title={option.description}
            className={`theme-card theme-card--${option.id}${selected ? ' is-selected' : ''}`}
            tabIndex={selected ? 0 : -1}
            ref={node => { buttons.current[index] = node }}
            onClick={() => onChange(option.id)}
            onKeyDown={event => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(index + 1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(index - 1)
              } else if (event.key === 'Home') {
                event.preventDefault()
                move(0)
              } else if (event.key === 'End') {
                event.preventDefault()
                move(THEME_OPTIONS.length - 1)
              }
            }}
          >
            <span className="theme-card__preview" aria-hidden>
              <i /><i /><i />
            </span>
            <strong>{option.name}</strong>
            <small>{option.description}</small>
          </button>
        )
      })}
    </div>
  )
}
