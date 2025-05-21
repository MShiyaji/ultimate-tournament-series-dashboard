import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

export function RisingStarsTable({ players, filterName }) {
  if (!players || players.length === 0) return null

  // Always use the full players array for ranking
  const allPlayers = players

  // Filter by player name if filterName is provided
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
          <CardDescription>
            Players with the largest normalized placement improvement
          </CardDescription>
        </div>
        <TrendingUp className="h-5 w-5 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-[520px] w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">Rank</TableHead>
                <TableHead className="px-2">Player</TableHead>
                <TableHead className="text-right px-2 w-24">Improvement</TableHead>
                <TableHead className="text-right px-2 w-20">Early Avg</TableHead>
                <TableHead className="text-right px-2 w-20">Late Avg</TableHead>
                <TableHead className="text-right px-2 w-16">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                // Find the player's overall rank among allPlayers
                const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
                const improvement = Number(player.improvementScore)
                const improvementColor =
                  improvement > 0
                    ? "text-green-700 font-bold"
                    : improvement < 0
                    ? "text-red-700 font-bold"
                    : ""

                return (
                  <TableRow key={player.id || player.name}>
                    <TableCell className="font-medium px-2">{overallRank}</TableCell>
                    <TableCell className="px-2">{player.name}</TableCell>
                    <TableCell className={`text-right px-2 ${improvementColor}`}>
                      {improvement.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right px-2">
                      {Number(player.earlyAvg).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right px-2">
                      <Badge variant="outline">
                        {Number(player.lateAvg).toFixed(3)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2">{player.tournaments}</TableCell>
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
