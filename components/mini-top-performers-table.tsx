import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Trophy } from "lucide-react"

export function MiniTopPerformersTable({ players, filterName }) {
  const displayPlayers = players
  const filteredPlayers = filterName?.trim()
    ? displayPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : displayPlayers.slice(0, 5) // Only show top 5 if no filter

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Top Performers</CardTitle>
          <CardDescription>Players with the highest weighted placements</CardDescription>
        </div>
        <Trophy className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="h-6">
              <TableHead className="w-10 p-1 text-xs">Rank</TableHead>
              <TableHead className="p-1 text-xs">Player</TableHead>
              <TableHead className="p-1 text-xs text-right">Score</TableHead>
              <TableHead className="p-1 text-xs text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.map((player) => {
              const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1
              // Medal colors for top 3
              let medalColor = ""
              if (overallRank === 1) medalColor = "#FFD700" // Gold
              else if (overallRank === 2) medalColor = "#C0C0C0" // Silver
              else if (overallRank === 3) medalColor = "#CD7F32" // Bronze

              return (
                <TableRow key={player.id} className="h-7">
                  <TableCell className="font-medium p-1 text-xs">
                    <span style={overallRank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                      {overallRank}
                    </span>
                  </TableCell>
                  <TableCell className="p-1 text-xs">
                    <div className="font-medium">{player.name}</div>
                  </TableCell>
                  <TableCell className="text-right p-1 text-xs">
                    {player.performanceScore || player.averageNormalizedPlacement}
                  </TableCell>
                  <TableCell className="text-right p-1 text-xs">{player.tournaments}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}