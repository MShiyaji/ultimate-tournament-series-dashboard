import { Target } from "lucide-react"

export function MiniConsistencyTable({ players, filterName }) {
  // Take at most 3 players to show in export view
  const filteredPlayers = filterName?.trim()
    ? players?.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : players?.slice(0, 5);

  return (
    <div className="bg-black rounded border border-gray-800 overflow-hidden shadow-md">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center">
        <h3 className="text-sm font-bold text-white flex-1">Most Consistent</h3>
        <Target className="h-3 w-3 text-gray-400" />
      </div>
      <div className="px-2 py-1">
        <table className="w-full text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="w-5 text-left py-1">#</th>
              <th className="text-left py-1 w-[38%]">Player</th>
              <th className="text-right py-1 w-[25%]">Events</th>
              <th className="text-right py-1 w-[15%]">%</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filteredPlayers?.map((player, idx) => {
              const consistencyValue = typeof player.consistency === "string"
                ? parseFloat(player.consistency.replace("%", ""))
                : player.consistency;
              
              return (
                <tr key={idx} className="border-t border-gray-800">
                  <td className="py-1">{idx + 1}</td>
                  <td className="py-1 font-medium truncate" style={{maxWidth: "90px"}}>{player.name}</td>
                  <td className="py-1 text-right">
                    {player.events || player.numEvents || "N/A"}
                  </td>
                  <td className="text-right py-1">{player.consistency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}