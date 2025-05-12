import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"

export function ConsistencyTable({ players }) {
  // Mock data for demonstration
  const mockPlayers = [
    { id: 1, name: "Dabuz", consistency: "92%", seedVariance: "±1.2", tournaments: 5 },
    { id: 2, name: "Marss", consistency: "87%", seedVariance: "±1.8", tournaments: 5 },
    { id: 3, name: "Kola", consistency: "85%", seedVariance: "±2.1", tournaments: 4 },
  ]

  // Filter players with at least 2 tournaments
  const displayPlayers = (players || mockPlayers).filter((player) => player.tournaments >= 2)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Most Consistent</CardTitle>
          <CardDescription>Players who consistently place their seed or higher</CardDescription>
        </div>
        <Target className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Consistency</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayPlayers.map((player, index) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{player.name}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={index < 2 ? "default" : "outline"}>{player.consistency}</Badge>
                </TableCell>
                <TableCell className="text-right">{player.tournaments}</TableCell>
                <TableCell className="text-right">{player.upsetFactorVariance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}