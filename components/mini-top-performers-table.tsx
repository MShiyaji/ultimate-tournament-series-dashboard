import { Trophy } from "lucide-react"

export function MiniTopPerformersTable({ players, filterName }: { players: any[], filterName: string }) {
  const displayPlayers = players
  const filteredPlayers = filterName?.trim()
    ? displayPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : displayPlayers.slice(0, 5) // Show top 5 if no filter

  return (
    <div className="bg-black rounded-lg border-2 border-gray-700 overflow-hidden shadow-md h-full flex flex-col">
      <div className="px-3 py-2 border-b-2 border-gray-700 flex items-center justify-center relative" style={{ background: "#0f172a" }}>
        <h3 className="text-sm font-bold text-white">Top Performers</h3>
        <Trophy className="h-3 w-3 text-gray-400 absolute right-3" />
      </div>
      <div className="px-2 py-1 flex-1">
        <table className="w-full text-xs">
          <thead className="text-gray-300" style={{ background: "#0f172a" }}>
            <tr>
              <th className="w-5 text-center py-1 px-1 border-b border-gray-700">#</th>
              <th className="text-center py-1 px-1 w-[38%] border-b border-gray-700">Player</th>
              <th className="text-center py-1 px-1 w-[25%] border-b border-gray-700">Events</th>
              <th className="text-center py-1 px-1 border-b border-gray-700">Score</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filteredPlayers.map((player, idx) => {
              const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1
              let medalColor = ""
              if (overallRank === 1) medalColor = "#FFD700" // Gold
              else if (overallRank === 2) medalColor = "#C0C0C0" // Silver
              else if (overallRank === 3) medalColor = "#CD7F32" // Bronze

              return (
                <tr key={player.id || idx} className={idx !== filteredPlayers.length - 1 ? "border-b border-gray-800" : ""}>
                  <td className="py-1 px-1 text-center">
                    <span style={overallRank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                      {overallRank}
                    </span>
                  </td>
                  <td className="py-1 px-1 text-center font-medium truncate" style={{maxWidth: "90px"}}>
                    {player.id ? (
                          <a
                            href={`https://www.supermajor.gg/ultimate/player/${encodeURIComponent(player.name)}?id=S${player.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {player.name}
                      </a>
                    ) : (
                      player.name
                    )}
                  </td>
                  <td className="py-1 px-1 text-center">
                    {player.tournaments || player.events || player.numEvents || "N/A"}
                  </td>
                  <td className="text-center py-1 px-1">
                    {player.performanceScore || player.averageNormalizedPlacement}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}