import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

export function SeedPerformanceTable({ players, filterName }) {
  // Always use the full players array for ranking
  const allPlayers = players

  // Filter by player name if filterName is provided
  const filteredPlayers = filterName?.trim()
    ? allPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : allPlayers.slice(0, 5) // Only show top 5 if no filter

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Seed Outperformers</CardTitle>
          <CardDescription>Players who place better than their seeds</CardDescription>
        </div>
        <TrendingUp className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Avg. Outperform</TableHead>
              <TableHead className="text-right">Best Upset Factor</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.map((player) => {
              // Color avgUpsetFactor: green if positive, red if negative, default otherwise
              const avg = Number(player.avgUpsetFactor)
              const avgColor =
                avg > 0
                  ? "text-green-700 font-bold"
                  : avg < 0
                  ? "text-red-700 font-bold"
                  : ""
              // Color bestOutperform: green if positive, red if negative, default otherwise
              const best = Number(player.bestOutperform)
              const bestColor =
                best > 0
                  ? "text-green-700 font-bold"
                  : best < 0
                  ? "text-red-700 font-bold"
                  : ""
              // Find the player's overall rank among allPlayers
              const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
              return (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{overallRank}</TableCell>
                  <TableCell>
                    <div className="font-medium">{player.name}</div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${avgColor}`}>
                    {isNaN(avg) ? "-" : avg.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={bestColor}>
                      {isNaN(best) ? "-" : best.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{player.tournaments}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
