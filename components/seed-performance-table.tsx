import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Eye } from "lucide-react"

export function SeedPerformanceTable({ players, filterName, onViewFullList }) {
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
        <div className="flex items-center gap-2">
          {!filterName && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewFullList}
              className="flex items-center gap-1 text-xs"
            >
              <Eye className="h-3 w-3" />
              View Full List
            </Button>
          )}
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="px-3">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">Rank</TableHead>
                <TableHead className="px-2">Player</TableHead>
                <TableHead className="text-right px-2 w-24">Avg. UF</TableHead>
                <TableHead className="text-right px-2 w-20 hidden md:table-cell">Best UF</TableHead>
                <TableHead className="text-right px-2 w-14 hidden sm:table-cell">Events</TableHead>
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
                    <TableCell className="font-medium px-2">{overallRank}</TableCell>
                    <TableCell className="px-2">
                      <div className="font-medium">{player.name}</div>
                      <div className="text-xs text-gray-500 sm:hidden">
                        Events: {player.tournaments}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${avgColor} px-2`}>
                      {isNaN(avg) ? "-" : avg.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right px-2 hidden md:table-cell">
                      <span className={bestColor}>
                        {isNaN(best) ? "-" : best.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-2 hidden sm:table-cell">{player.tournaments}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
