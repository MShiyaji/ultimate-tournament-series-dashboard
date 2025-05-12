import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

export function SeedPerformanceTable({ players }) {
  // Mock data for demonstration
  const mockPlayers = [
    { id: 1, name: "ProtoBanham", avgUpsetFactor: "+12.4", bestOutperform: "+24", tournaments: 4 },
    { id: 2, name: "Zomba", avgUpsetFactor: "+8.7", bestOutperform: "+16", tournaments: 5 },
    { id: 3, name: "Riddles", avgUpsetFactor: "+7.2", bestOutperform: "+12", tournaments: 5 },
  ]

  const displayPlayers = players || mockPlayers

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
            {displayPlayers.map((player, index) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{player.name}</div>
                </TableCell>
                <TableCell className="text-right font-medium text-green-600 dark:text-green-500">
                  {player.avgUpsetFactor}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-green-600 dark:text-green-500">
                    {player.bestOutperform}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{player.tournaments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
