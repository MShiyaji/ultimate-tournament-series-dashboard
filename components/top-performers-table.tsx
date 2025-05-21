import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
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

export function TopPerformersTable({ players, filterName}) {
  const displayPlayers = players; // fallback if not provided

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
          <CardDescription>Players with the highest weighted placements</CardDescription>
        </div>
        <Trophy className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="px-3">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">Rank</TableHead>
                <TableHead className="px-2">Player</TableHead>
                <TableHead className="text-right px-2 w-24">Perf. Score</TableHead>
                <TableHead className="text-right px-2 w-20">Best Place</TableHead>
                <TableHead className="text-right px-2 w-14">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                // Find the player's overall rank in the full list
                const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1;

                // Medal colors for top 3
                let medalColor = "";
                if (overallRank === 1) medalColor = "#FFD700";
                else if (overallRank === 2) medalColor = "#C0C0C0";
                else if (overallRank === 3) medalColor = "#CD7F32";

                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium px-2">
                      <span style={overallRank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                        {overallRank}
                      </span>
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="font-medium">{player.name}</div>
                    </TableCell>
                    <TableCell className="text-right px-2">{player.performanceScore || player.averageNormalizedPlacement}</TableCell>
                    <TableCell className="text-right px-2">
                      <span className="font-medium">{player.bestPlacement}</span>
                    </TableCell>
                    <TableCell className="text-right px-2">{player.tournaments}</TableCell>
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
