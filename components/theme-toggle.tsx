
'use client'

import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'dokkan-theme'
const THEME_CHANGE_EVENT = 'dokkan-theme-change'

function isValidTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement

  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

function readSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isValidTheme(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const initialTheme = readSavedTheme()

    setTheme(initialTheme)
    applyTheme(initialTheme)
    setReady(true)

    function handleThemeChange(event: Event) {
      const customEvent = event as CustomEvent<Theme>

      if (isValidTheme(customEvent.detail)) {
        setTheme(customEvent.detail)
        applyTheme(customEvent.detail)
      }
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) {
        return
      }

      const nextTheme = isValidTheme(event.newValue)
        ? event.newValue
        : 'system'

      setTheme(nextTheme)
      applyTheme(nextTheme)
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme)
    applyTheme(nextTheme)

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // يظل تغيير المظهر فعالًا حتى لو تعذر حفظه.
    }

    window.dispatchEvent(
      new CustomEvent<Theme>(THEME_CHANGE_EVENT, {
        detail: nextTheme,
      })
    )
  }

  const options: {
    value: Theme
    label: string
    icon: typeof Monitor
  }[] = [
    { value: 'system', label: 'تلقائي', icon: Monitor },
    { value: 'light', label: 'فاتح', icon: Sun },
    { value: 'dark', label: 'داكن', icon: Moon },
  ]

  return (
    <div
      dir="rtl"
      role="group"
      aria-label="اختيار مظهر Dokkan"
      className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value

        return (
          <button
            key={value}
            type="button"
            disabled={!ready}
            onClick={() => changeTheme(value)}
            aria-pressed={active}
            aria-label={`المظهر ${label}`}
            title={`المظهر ${label}`}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition ${
              active
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
