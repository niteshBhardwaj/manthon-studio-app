import { type JSX } from 'react'
import type { ModelDescriptor } from '../../../lib/model-capabilities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'

export function ModelSelector({
  models,
  value,
  onChange
}: {
  models: ModelDescriptor[]
  value: string
  onChange: (modelId: string) => void
}): JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-xl bg-white/5 px-3.5 text-[0.85rem] font-medium text-text-primary outline-none transition-all hover:bg-white/10 border-none ring-0 focus:ring-0 focus:ring-offset-0 focus:bg-white/10">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent className="bg-bg-elevated border-border-subtle rounded-xl text-text-primary z-50">
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="cursor-pointer focus:bg-white/10 focus:text-text-primary rounded-lg text-[0.85rem] font-medium">
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
