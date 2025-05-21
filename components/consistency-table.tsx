import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"

export function ConsistencyTable({ players, filterName }) {
  // Use provided players or mock data, filter for at least 2 tournaments
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
          <CardTitle className="text-xl font-bold">Most Consistent</CardTitle>
          <CardDescription>Players who consistently place their seed or higher</CardDescription>
        </div>
        <Target className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="px-3">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">Rank</TableHead>
                <TableHead className="px-2">Player</TableHead>
                <TableHead className="text-right px-2 w-20">Consistency</TableHead>
                <TableHead className="text-right px-2 w-14">Events</TableHead>
                <TableHead className="text-right px-2 w-16">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                // Find the player's overall rank among allPlayers
                const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
                // Parse consistency as a number (strip % if present)
                const consistencyValue = typeof player.consistency === "string"
                  ? parseFloat(player.consistency.replace("%", ""))
                  : player.consistency

                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium px-2">{overallRank}</TableCell>
                    <TableCell className="px-2">
                      <div className="font-medium">{player.name}</div>
                    </TableCell>
                    <TableCell className="text-right px-2">
                      {consistencyValue > 90 ? (
                        <span className="font-semibold" style={{ color: "#FFD700" }}>{player.consistency}</span>
                      ) : (
                        <span className="font-medium text-white">{player.consistency}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-2">{player.tournaments}</TableCell>
                    <TableCell className="text-right px-2">{player.seedVariance ?? player.upsetFactorVariance}</TableCell>
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