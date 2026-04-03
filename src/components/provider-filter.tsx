import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  approvedJobHostFamilies,
  defaultProviders,
  MAX_SELECTED_PROVIDERS,
  providerLabels,
} from '../../convex/shared/constants'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { cn } from '~/lib/utils'

const allProviders = approvedJobHostFamilies.map((f) => f.provider)

type ProviderFilterProps = {
  selected: string[]
  onChange: (providers: string[]) => void
}

export function ProviderFilter({ selected, onChange }: ProviderFilterProps) {
  const [open, setOpen] = useState(false)

  const hasReachedSelectionLimit = selected.length >= MAX_SELECTED_PROVIDERS

  function toggle(provider: string) {
    if (selected.includes(provider)) {
      if (selected.length === 1) return
      onChange(selected.filter((p) => p !== provider))
    } else {
      if (hasReachedSelectionLimit) return
      onChange([...selected, provider])
    }
  }

  function resetSelection() {
    onChange([...defaultProviders])
  }

  const label = `${selected.length} site${selected.length === 1 ? '' : 's'}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 gap-1.5 rounded-full px-3 text-sm"
          size="sm"
          type="button"
          variant="outline"
        >
          {label}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Select up to {MAX_SELECTED_PROVIDERS} job boards.
            </p>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={resetSelection}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {allProviders.map((provider) => {
            const checked = selected.includes(provider)
            const disabled =
              (!checked && hasReachedSelectionLimit) ||
              (checked && selected.length === 1)

            return (
              <label
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  disabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:bg-accent',
                )}
                key={provider}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(provider)}
                />
                <span>{providerLabels[provider] ?? provider}</span>
              </label>
            )
          })}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {hasReachedSelectionLimit
            ? `Maximum ${MAX_SELECTED_PROVIDERS} job boards selected. Deselect one to choose another.`
            : `You can choose ${MAX_SELECTED_PROVIDERS - selected.length} more job board${MAX_SELECTED_PROVIDERS - selected.length === 1 ? '' : 's'}.`}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1 border-t px-3 py-2">
            {selected.map((provider) => (
              <Badge
                className={cn(
                  'text-xs',
                  selected.length === 1 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
                key={provider}
                onClick={() => {
                  if (selected.length > 1) {
                    toggle(provider)
                  }
                }}
                variant="secondary"
              >
                {providerLabels[provider] ?? provider} ×
              </Badge>
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export { allProviders, defaultProviders }
