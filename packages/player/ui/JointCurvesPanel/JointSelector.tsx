'use client'
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Checkbox } from '../../components/ui/checkbox'
import { cn } from '../../lib/utils'
import { jointColor } from './colors'

interface JointSelectorProps {
  jointNames: string[]
  visibleJoints: number[]
  onToggle: (ji: number, checked: boolean) => void
  onToggleAll: (allVisible: boolean) => void
}

export function JointSelector({ jointNames, visibleJoints, onToggle, onToggleAll }: JointSelectorProps) {
  const [open, setOpen] = useState(false)
  const N = jointNames.length
  const visibleSet = useMemo(() => new Set(visibleJoints), [visibleJoints])
  const allChecked = visibleSet.size === N
  const indeterminate = visibleSet.size > 0 && !allChecked

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-1 text-xs font-semibold bg-transparent border-0 cursor-pointer p-0"
        style={{ color: 'var(--ink)' }}
      >
        {allChecked ? '全部' : `${visibleJoints.length}/${N}`} joints
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="pb-1 border-b border-[var(--border-subtle)] mb-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer px-1 py-0.5">
            <Checkbox
              checked={allChecked}
              indeterminate={indeterminate}
              onCheckedChange={(v) => onToggleAll(!!v)}
            />
            全部 joints
          </label>
        </div>
        <div className="max-h-48 overflow-auto">
          {jointNames.map((name, i) => (
            <label key={name} className="flex items-center gap-2 text-xs cursor-pointer px-1 py-0.5">
              <Checkbox
                checked={visibleSet.has(i)}
                onCheckedChange={(v) => onToggle(i, !!v)}
              />
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: jointColor(i) }}
              />
              <span className="truncate">{name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
