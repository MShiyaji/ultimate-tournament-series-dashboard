"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function DateRangeSelector({ dateRange, onDateRangeChange }) {
  const [startDate, setStartDate] = useState(dateRange.start ? new Date(dateRange.start) : undefined)
  const [endDate, setEndDate] = useState(dateRange.end ? new Date(dateRange.end) : undefined)

  const handleStartDateChange = (selectedDate) => {
    setStartDate(selectedDate)
    onDateRangeChange({
      start: format(selectedDate, "yyyy-MM-dd"),
      end: endDate ? format(endDate, "yyyy-MM-dd") : "",
    })
  }

  const handleEndDateChange = (selectedDate) => {
    setEndDate(selectedDate)
    onDateRangeChange({
      start: startDate ? format(startDate, "yyyy-MM-dd") : "",
      end: format(selectedDate, "yyyy-MM-dd"),
    })
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="start-date"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Start Date
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="start-date"
              variant="outline"
              className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "LLL dd, y") : <span>Select start date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="single"
              selected={startDate}
              onSelect={handleStartDateChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col space-y-1.5">
        <label
          htmlFor="end-date"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          End Date
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="end-date"
              variant="outline"
              className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "LLL dd, y") : <span>Select end date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="single"
              selected={endDate}
              onSelect={handleEndDateChange}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
