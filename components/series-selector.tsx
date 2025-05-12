"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function SeriesSelector({ series, selectedSeries, onSelectSeries }) {
  const [open, setOpen] = useState(false)

  // Mock data for demonstration
  const mockSeries = [
    { id: "series-1", name: "EVO Championship Series" },
    { id: "series-2", name: "Combo Breaker Series" },
    { id: "series-3", name: "CEO Gaming Series" },
    { id: "series-4", name: "Genesis Series" },
    { id: "series-5", name: "Smash World Tour" },
  ]

  const displaySeries = series && series.length > 0 ? series : mockSeries

  return (
    <div className="flex flex-col space-y-1.5">
      <label
        htmlFor="series-selector"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Tournament Series
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="series-selector"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between"
          >
            {selectedSeries ? displaySeries.find((s) => s.id === selectedSeries)?.name : "Select series..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-full min-w-[240px]">
          <Command>
            <CommandInput placeholder="Search series..." />
            <CommandList>
              <CommandEmpty>No series found.</CommandEmpty>
              <CommandGroup>
                {displaySeries.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onSelectSeries(s.id === selectedSeries ? "" : s.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedSeries === s.id ? "opacity-100" : "opacity-0")} />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
