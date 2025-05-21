import { TrendingUp } from "lucide-react"

export function MiniRisingStarsTable({ players, filterName }) {
  if (!players || players.length === 0) return null

  const allPlayers = players
  const filteredPlayers = filterName?.trim()
    ? allPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : allPlayers.slice(0, 5) // Only show top 3 if no filter

  return (
    <div className="bg-black rounded border border-gray-800 overflow-hidden shadow-md">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center">
        <h3 className="text-sm font-bold text-white flex-1">Rising Stars</h3>
        <TrendingUp className="h-3 w-3 text-gray-400" />
      </div>
      <div className="px-2 py-1">
        <table className="w-full text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="w-6 text-left py-1">#</th>
              <th className="text-left py-1">Player</th>
              <th className="text-right py-1">Improve</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filteredPlayers.map((player) => {
              const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
              const improvement = Number(player.improvementScore)
              
              return (
                <tr key={player.id || player.name} className="border-t border-gray-800">
                  <td className="py-1">{overallRank}</td>
                  <td className="py-1 font-medium truncate" style={{maxWidth: "120px"}}>{player.name}</td>
                  <td className="text-right py-1">
                    {improvement.toFixed(2)}
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