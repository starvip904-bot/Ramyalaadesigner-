
'use client'

import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'dokkan-theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement

  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)

      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved)
        applyTheme(saved)
      } else {
        applyTheme('system')
      }
    } catch {
      applyTheme('system')
    }

    setReady(true)
  }, [])

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme)
    applyTheme(nextTheme)

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // يظل تغيير المظهر فعالًا حتى لو تعذر حفظه.
    }
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
