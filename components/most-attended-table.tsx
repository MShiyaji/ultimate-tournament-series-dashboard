import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

export function MostAttendedTable({ players, filterName }: { players: any[]; filterName?: string }) {
  const isMobile = useIsMobile();

  const allPlayers = players || [];

  const filteredPlayers = filterName?.trim()
    ? allPlayers.filter((p: any) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : allPlayers.slice(0, 5);

  if (filteredPlayers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Most Attended</CardTitle>
          <CardDescription className="text-xs">Players who attended the most tournaments</CardDescription>
        </div>
        <Users className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className={isMobile ? "px-2" : "px-3"}>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? "w-8 px-1" : "w-1/6 px-2 text-center"}>Rank</TableHead>
                <TableHead className={isMobile ? "px-1 min-w-[120px]" : "w-2/6 px-2"}>Player</TableHead>
                <TableHead className={isMobile ? "text-right px-1 w-20" : "w-1/6 px-2 text-center"}>Tournaments</TableHead>
                {!isMobile && <TableHead className="w-1/6 px-2 text-center">Avg Place</TableHead>}
                {!isMobile && <TableHead className="w-1/6 px-2 text-center">Best Place</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player: any, idx: number) => {
                const overallRank = allPlayers.findIndex((p: any) => p.id === player.id) + 1;
                return (
                  <TableRow key={player.id || idx}>
                    <TableCell className={isMobile ? "font-medium px-1" : "font-medium px-2 text-center"}>
                      {overallRank}
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : "px-2"}>
                      <div className="font-medium leading-tight">{player.name}</div>
                      {isMobile && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Avg: {player.avgPlacement} · Best: {player.bestPlacement}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={isMobile ? "text-right px-1 tabular-nums" : "px-2 text-center tabular-nums"}>
                      {player.tournaments}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="px-2 text-center tabular-nums">
                        {player.avgPlacement}
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell className="px-2 text-center tabular-nums">
                        {player.bestPlacement}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
