import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

export function MiniRisingStarsTable({ players, filterName }) {
  if (!players || players.length === 0) return null

  const allPlayers = players
  const filteredPlayers = filterName?.trim()
    ? allPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : allPlayers.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Rising Stars</CardTitle>
          <CardDescription>Largest normalized placement improvement</CardDescription>
        </div>
        <TrendingUp className="h-5 w-5 text-green-600" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="h-6">
              <TableHead className="w-10 p-1 text-xs">Rank</TableHead>
              <TableHead className="p-1 text-xs">Player</TableHead>
              <TableHead className="p-1 text-xs text-right">Improvement</TableHead>
              <TableHead className="p-1 text-xs text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlayers.map((player) => {
              const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
              const improvement = Number(player.improvementScore)
              const improvementColor =
                improvement > 0
                  ? "text-green-700 font-bold"
                  : improvement < 0
                  ? "text-red-700 font-bold"
                  : ""
              return (
                <TableRow key={player.id || player.name} className="h-7">
                  <TableCell className="font-medium p-1 text-xs">{overallRank}</TableCell>
                  <TableCell className="p-1 text-xs">{player.name}</TableCell>
                  <TableCell className={`text-right p-1 text-xs ${improvementColor}`}>
                    {improvement.toFixed(3)}
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