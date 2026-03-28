import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  approvedJobHostFamilies,
  providerLabels,
} from '../../convex/searchConstants'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'

const allProviders = approvedJobHostFamilies.map((f) => f.provider)

type ProviderFilterProps = {
  selected: string[]
  onChange: (providers: string[]) => void
}

export function ProviderFilter({ selected, onChange }: ProviderFilterProps) {
  const [open, setOpen] = useState(false)

  const allSelected = selected.length === allProviders.length
  const noneSelected = selected.length === 0

  function toggle(provider: string) {
    if (selected.includes(provider)) {
      onChange(selected.filter((p) => p !== provider))
    } else {
      onChange([...selected, provider])
    }
  }

  function toggleAll() {
    onChange(allSelected ? [] : [...allProviders])
  }

  const label = allSelected
    ? 'All sites'
    : noneSelected
      ? 'No sites selected'
      : `${selected.length} site${selected.length === 1 ? '' : 's'}`

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
      <PopoverContent align="start" className="w-56 p-0">
        <div className="border-b px-3 py-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={toggleAll}
            type="button"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {allProviders.map((provider) => {
            const checked = selected.includes(provider)

            return (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                key={provider}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(provider)}
                />
                <span>{providerLabels[provider] ?? provider}</span>
              </label>
            )
          })}
        </div>
        {!allSelected ? (
          <div className="flex flex-wrap gap-1 border-t px-3 py-2">
            {selected.map((provider) => (
              <Badge
                className="cursor-pointer text-xs"
                key={provider}
                onClick={() => toggle(provider)}
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

export { allProviders }
