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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Eye } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

export function RisingStarsTable({ players, filterName, onViewFullList }) {
  const isMobile = useIsMobile();
  
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
          <CardDescription className="text-xs">
            Players with the largest normalized placement improvement
          </CardDescription>
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
              {isMobile ? "Full List" : "View Full List"}
            </Button>
          )}
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "px-2" : "px-6"}>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? "w-8 px-1" : "w-1/6 px-2 text-center"}>Rank</TableHead>
                <TableHead className={isMobile ? "px-1 min-w-[120px]" : "w-2/6 px-2"}>Player</TableHead>
                {!isMobile && <TableHead className="w-1/6 px-2 text-center">Improvement</TableHead>}
                {!isMobile && <TableHead className="w-1/6 px-2 text-center">Early Avg</TableHead>}
                {!isMobile && <TableHead className="w-1/6 px-2 text-center">Late Avg</TableHead>}
                <TableHead className={isMobile ? "text-right px-1 w-12" : "w-1/6 px-2 text-center"}>Events</TableHead>
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
                    <TableCell className={isMobile ? "font-medium px-1" : "font-medium px-2 text-center"}>
                      {overallRank}
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : "px-2"}>
                      <div className="font-medium leading-tight">{player.name}</div>
                      {isMobile && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div className={improvementColor}>
                            Improvement: {improvement.toFixed(3)}
                          </div>
                          <div className="text-gray-400">
                            Avgs: {Number(player.earlyAvg).toFixed(2)} → {Number(player.lateAvg).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className={`px-2 text-center ${improvementColor}`}>
                        {improvement.toFixed(3)}
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        {Number(player.earlyAvg).toFixed(3)}
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        <Badge variant="outline">
                          {Number(player.lateAvg).toFixed(3)}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className={isMobile ? "text-right px-1 text-xs" : "px-2 text-center"}>
                      {player.tournaments}
                    </TableCell>
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