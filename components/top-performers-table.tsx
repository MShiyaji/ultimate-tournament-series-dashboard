import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, Eye } from "lucide-react"
import { useState } from "react"
import { Info } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-block ml-1 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      tabIndex={0}
    >
      <button
        type="button"
        aria-label="Info"
        className="text-gray-400 hover:text-gray-600 focus:outline-none p-0 m-0"
        tabIndex={-1}
        style={{ lineHeight: 0 }}
      >
        <Info className="inline h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute z-20 left-full top-0 -translate-y-full ml-2 w-72 rounded-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg p-3 text-xs text-gray-800 dark:text-gray-200"
          style={{ minWidth: "16rem", maxWidth: "20rem", whiteSpace: "normal" }}
        >
          {text}
        </div>
      )}
    </span>
  )
}

export function TopPerformersTable({ players, filterName, onViewFullList }) {
  const isMobile = useIsMobile();
  const displayPlayers = players;

  const filteredPlayers = filterName?.trim()
    ? displayPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : displayPlayers.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Top Performers</CardTitle>
          <CardDescription className="text-xs">Players with the highest weighted placements</CardDescription>
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
          <Trophy className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className={isMobile ? "px-2" : "px-3"}>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? "w-8 px-1" : "w-1/5 px-2 text-center"}>Rank</TableHead>
                <TableHead className={isMobile ? "px-1 min-w-[120px]" : "w-2/5 px-2"}>Player</TableHead>
                {!isMobile && <TableHead className="w-1/5 px-2 text-center">Perf. Score</TableHead>}
                {!isMobile && <TableHead className="w-1/5 px-2 text-center">Best Place</TableHead>}
                <TableHead className={isMobile ? "text-right px-1 w-12" : "w-1/5 px-2 text-center"}>Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1;
                let medalColor = "";
                if (overallRank === 1) medalColor = "#FFD700";
                else if (overallRank === 2) medalColor = "#C0C0C0";
                else if (overallRank === 3) medalColor = "#CD7F32";

                return (
                  <TableRow key={player.id}>
                    <TableCell className={isMobile ? "font-medium px-1" : "font-medium px-2 text-center"}>
                      <span style={overallRank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                        {overallRank}
                      </span>
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : "px-2"}>
                      <div className="font-medium leading-tight">{player.name}</div>
                      {isMobile && (
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div>Perf Score: {player.performanceScore || player.averageNormalizedPlacement}</div>
                          <div>Best Placement: {player.bestPlacement}</div>
                        </div>
                      )}
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        {player.performanceScore || player.averageNormalizedPlacement}
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell className="px-2 text-center">
                        <span className="font-medium">{player.bestPlacement}</span>
                      </TableCell>
                    )}
                    <TableCell className={isMobile ? "text-right px-1 text-xs" : "px-2 text-center"}>
                      {player.tournaments}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}