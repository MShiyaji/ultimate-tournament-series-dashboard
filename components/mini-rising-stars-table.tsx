import { TrendingUp } from "lucide-react"

export function MiniRisingStarsTable({ players, filterName }) {
  if (!players || players.length === 0) return null

  const allPlayers = players
  const filteredPlayers = filterName?.trim()
    ? allPlayers.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : allPlayers.slice(0, 5) // Show top 5 if no filter

  return (
    <div className="bg-black rounded border-2 border-gray-700 overflow-hidden shadow-md">
      <div className="px-3 py-2 border-b-2 border-gray-700 flex items-center bg-gray-900">
        <h3 className="text-sm font-bold text-white flex-1">Rising Stars</h3>
        <TrendingUp className="h-3 w-3 text-gray-400" />
      </div>
      <div className="px-2 py-1">
        <table className="w-full text-xs">
          <thead className="text-gray-300 bg-gray-900">
            <tr>
              <th className="w-5 text-left py-1 px-1 border-b border-gray-700">#</th>
              <th className="text-left py-1 px-1 w-[38%] border-b border-gray-700">Player</th>
              <th className="text-right py-1 px-1 w-[25%] border-b border-gray-700">Events</th>
              <th className="text-right py-1 px-1 border-b border-gray-700">Improve</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filteredPlayers.map((player, idx) => {
              const overallRank = allPlayers.findIndex(p => p.id === player.id) + 1
              const improvement = Number(player.improvementScore)
              
              return (
                <tr key={player.id || player.name || idx} className={idx !== filteredPlayers.length - 1 ? "border-b border-gray-800" : ""}>
                  <td className="py-1 px-1">{overallRank || (idx + 1)}</td>
                  <td className="py-1 px-1 font-medium truncate" style={{maxWidth: "90px"}}>{player.name}</td>
                  <td className="py-1 px-1 text-right">
                    {player.tournaments || player.events || player.numEvents || "N/A"}
                  </td>
                  <td className="text-right py-1 px-1">
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