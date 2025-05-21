import { Trophy } from "lucide-react"

export function MiniTopPerformersTable({ players, filterName }) {
  const displayPlayers = players
  const filteredPlayers = filterName?.trim()
    ? displayPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : displayPlayers.slice(0, 5) // Only show top 3 if no filter

  return (
    <div className="bg-black rounded border border-gray-800 overflow-hidden shadow-md">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center">
        <h3 className="text-sm font-bold text-white flex-1">Top Performers</h3>
        <Trophy className="h-3 w-3 text-gray-400" />
      </div>
      <div className="px-2 py-1">
        <table className="w-full text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="w-6 text-left py-1">#</th>
              <th className="text-left py-1">Player</th>
              <th className="text-right py-1">Score</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filteredPlayers.map((player) => {
              const overallRank = displayPlayers.findIndex(p => p.id === player.id) + 1
              let medalColor = ""
              if (overallRank === 1) medalColor = "#FFD700" // Gold
              else if (overallRank === 2) medalColor = "#C0C0C0" // Silver
              else if (overallRank === 3) medalColor = "#CD7F32" // Bronze

              return (
                <tr key={player.id} className="border-t border-gray-800">
                  <td className="py-1">
                    <span style={overallRank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                      {overallRank}
                    </span>
                  </td>
                  <td className="py-1 font-medium truncate" style={{maxWidth: "120px"}}>{player.name}</td>
                  <td className="text-right py-1">
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