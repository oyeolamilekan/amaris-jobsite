import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '~/lib/theme'
import { Button } from '~/components/ui/button'

const modes = ['light', 'dark', 'system'] as const

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

const labels = {
  light: 'Switch to dark mode',
  dark: 'Switch to system theme',
  system: 'Switch to light mode',
} as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = icons[theme]
  const nextIndex = (modes.indexOf(theme) + 1) % modes.length

  return (
    <Button
      aria-label={labels[theme]}
      onClick={() => setTheme(modes[nextIndex]!)}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icon className="size-4" />
    </Button>
  )
}
