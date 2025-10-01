import { Award, Users, BarChart, TrendingUp } from "lucide-react"

export function StatsCards({ stats, playerName, isExporting }) {
  const displayStats = stats || {
    totalPlayers: 0,
    totalTournaments: 0,
    averageEntrants: 0,
    upsetRate: "0%",
    playerEvents: 0,
    playerUnique: 0,
    playerTournaments: 0,
  }

  // For player-specific view (2 cards)
  if (playerName && playerName.trim()) {
    const tournamentsAttended =
      displayStats.playerTournaments ?? displayStats.playerEvents ?? displayStats.totalTournaments
    const uniquePlayers =
      displayStats.playerUnique ?? displayStats.playerTotalOpponents ?? displayStats.totalPlayers

    return (
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white">Tournaments</h3>
            <Award className="h-3 w-3 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-white">{tournamentsAttended}</div>
          <p className="text-xs text-gray-400">Events attended</p>
        </div>
        <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white">Unique Players</h3>
            <Users className="h-3 w-3 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-white">{uniquePlayers}</div>
          <p className="text-xs text-gray-400">Opponents faced</p>
        </div>
      </div>
    )
  }

  // For general view (4 cards)
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Players</h3>
          <Users className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white">{displayStats.totalPlayers}</div>
        <p className="text-xs text-gray-400">Unique competitors</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Tournaments</h3>
          <Award className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white">{displayStats.totalTournaments}</div>
        <p className="text-xs text-gray-400">Events in series</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Avg. Entrants</h3>
          <BarChart className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white">{displayStats.averageEntrants}</div>
        <p className="text-xs text-gray-400">Per tournament</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Upset Rate</h3>
          <TrendingUp className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white">{displayStats.upsetRate}</div>
        <p className="text-xs text-gray-400">Lower &gt; higher seeds</p>
      </div>
    </div>
  )
}