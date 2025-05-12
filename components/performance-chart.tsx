"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

// Define chart colors
const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function PerformanceChart({ data }) {
  // If no data is provided, use mock data
  const mockData = [
    { tournament: "Tournament 1", MkLeo: 1, Tweek: 2, Sparg0: 3, Light: 5, Glutonny: 4 },
    { tournament: "Tournament 2", MkLeo: 1, Tweek: 3, Sparg0: 2, Light: 4, Glutonny: 5 },
    { tournament: "Tournament 3", MkLeo: 2, Tweek: 1, Sparg0: 5, Light: 3, Glutonny: 4 },
    { tournament: "Tournament 4", MkLeo: 1, Tweek: 2, Sparg0: 3, Light: 5, Glutonny: 7 },
    { tournament: "Tournament 5", MkLeo: 3, Tweek: 5, Sparg0: 2, Light: 4, Glutonny: 7 },
  ]

  const displayData = data || mockData

  // Extract player names from the data (excluding 'tournament' key)
  const playerNames = displayData.length > 0 ? Object.keys(displayData[0]).filter((key) => key !== "tournament") : []

  // Create config object for ChartContainer
  const chartConfig = {}
  playerNames.forEach((player, index) => {
    chartConfig[player] = {
      label: player,
      color: chartColors[index % chartColors.length],
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>Placement history for top players across tournaments</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="aspect-[4/3]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayData}
              margin={{
                top: 5,
                right: 10,
                left: 10,
                bottom: 0,
              }}
            >
              <XAxis dataKey="tournament" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickMargin={10} />
              <YAxis
                reversed={true}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickMargin={10}
                domain={[1, "dataMax"]}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {playerNames.map((player, index) => (
                <Line
                  key={player}
                  type="monotone"
                  dataKey={player}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                  stroke={`var(--color-${player})`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
