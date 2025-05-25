import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Eye } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

export function ConsistencyTable({ players, filterName, onViewFullList }) {
  const isMobile = useIsMobile();
  
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
          <CardDescription className="text-xs">Players who consistently place their seed or higher</CardDescription>
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
          <Target className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "px-2" : "px-3"}>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? "w-8 px-1" : "w-1/5 px-2 text-center"}>Rank</TableHead>
                <TableHead className={isMobile ? "px-1 min-w-[120px]" : "w-2/5 px-2"}>Player</TableHead>
                {!isMobile && <TableHead className="w-1/5 px-2 text-center">Consistency</TableHead>}
                <TableHead className={isMobile ? "text-right px-1 w-12" : "w-1/5 px-2 text-center"}>Events</TableHead>
                {!isMobile && <TableHead className="w-1/5 px-2 text-center">Variance</TableHead>}
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
                    <TableCell className={isMobile ? "font-medium px-1" : "font-medium px-2 text-center"}>
                      {overallRank}
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : "px-2"}>
                      <div className="font-medium leading-tight">{player.name}</div>
                      {isMobile && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div>
                            Consistency: {consistencyValue > 90 ? (
                              <span className="font-semibold" style={{ color: "#FFD700" }}>
                                {player.consistency}
                              </span>
                            ) : (
                              <span className="font-medium">{player.consistency}</span>
                            )}
                          </div>
                          <div>Variance: {player.seedVariance ?? player.upsetFactorVariance}</div>
                        </div>
                      )}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        {consistencyValue > 90 ? (
                          <span className="font-semibold" style={{ color: "#FFD700" }}>
                            {player.consistency}
                          </span>
                        ) : (
                          <span className="font-medium text-white">{player.consistency}</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className={isMobile ? "text-right px-1 text-xs" : "px-2 text-center"}>
                      {player.tournaments}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        {player.seedVariance ?? player.upsetFactorVariance}
                      </TableCell>
                    )}
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