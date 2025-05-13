import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"

export function TopPerformersTable({ players, filterName }) {
  // Mock data for demonstration

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
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Performance Score</TableHead>
              <TableHead className="text-right">Best Placement</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.map((player) => {
              // Find the player's overall rank in the full list
              const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1
              return (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{overallRank}</TableCell>
                  <TableCell>
                    <div className="font-medium">{player.name}</div>
                  </TableCell>
                  <TableCell className="text-right">{player.performanceScore || player.averageNormalizedPlacement}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={overallRank < 3 ? "default" : "outline"}>{player.bestPlacement}</Badge>
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
