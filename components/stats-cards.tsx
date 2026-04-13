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

  // Card outer container
  const cardClass = isExporting
    ? "bg-black rounded-lg border-2 border-gray-700 overflow-hidden shadow-md flex flex-col"
    : "bg-black rounded border border-gray-800 p-3 shadow-md"

  // For player-specific view (2 cards)
  if (playerName && playerName.trim()) {
    const tournamentsAttended =
      displayStats.playerTournaments ?? displayStats.playerEvents ?? displayStats.totalTournaments
    const uniquePlayers =
      displayStats.playerUnique ?? displayStats.playerTotalOpponents ?? displayStats.totalPlayers

    if (isExporting) {
      return (
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className={cardClass}>
            {/* Centered header row with background */}
            <div className="flex items-center justify-center gap-2 px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
              <h3 className="text-sm font-bold text-white text-center">Tournaments</h3>
              <Award className="h-3 w-3 text-gray-400 absolute right-3" />
            </div>
            <div className="flex flex-col items-center justify-center flex-1 py-2">
              <div className="text-xl font-bold text-white text-center">{tournamentsAttended}</div>
              <p className="text-xs text-gray-400 text-center">Events attended</p>
            </div>
          </div>
          <div className={cardClass}>
            <div className="flex items-center justify-center gap-2 px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
              <h3 className="text-sm font-bold text-white text-center">Unique Players</h3>
              <Users className="h-3 w-3 text-gray-400 absolute right-3" />
            </div>
            <div className="flex flex-col items-center justify-center flex-1 py-2">
              <div className="text-xl font-bold text-white text-center">{uniquePlayers}</div>
              <p className="text-xs text-gray-400 text-center">Opponents faced</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white">Tournaments</h3>
            <Award className="h-3 w-3 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-white text-center">{tournamentsAttended}</div>
          <p className="text-xs text-gray-400 text-center">Events attended</p>
        </div>
        <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white">Unique Players</h3>
            <Users className="h-3 w-3 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-white text-center">{uniquePlayers}</div>
          <p className="text-xs text-gray-400 text-center">Opponents faced</p>
        </div>
      </div>
    )
  }

  // For general view (4 cards) — export version
  if (isExporting) {
    return (
      <div className="grid grid-cols-4 gap-3 w-full">
        <div className={cardClass}>
          <div className="flex items-center justify-center px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
            <h3 className="text-sm font-bold text-white text-center">Players</h3>
            <Users className="h-3 w-3 text-gray-400 absolute right-3" />
          </div>
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            <div className="text-xl font-bold text-white text-center">{displayStats.totalPlayers}</div>
            <p className="text-xs text-gray-400 text-center">Unique competitors</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-center px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
            <h3 className="text-sm font-bold text-white text-center">Tournaments</h3>
            <Award className="h-3 w-3 text-gray-400 absolute right-3" />
          </div>
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            <div className="text-xl font-bold text-white text-center">{displayStats.totalTournaments}</div>
            <p className="text-xs text-gray-400 text-center">Events in series</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-center px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
            <h3 className="text-sm font-bold text-white text-center">Avg. Entrants</h3>
            <BarChart className="h-3 w-3 text-gray-400 absolute right-3" />
          </div>
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            <div className="text-xl font-bold text-white text-center">{displayStats.averageEntrants}</div>
            <p className="text-xs text-gray-400 text-center">Per tournament</p>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-center px-3 py-2 border-b-2 border-gray-700 relative" style={{ background: "#0f172a" }}>
            <h3 className="text-sm font-bold text-white text-center">Upset Rate</h3>
            <TrendingUp className="h-3 w-3 text-gray-400 absolute right-3" />
          </div>
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            <div className="text-xl font-bold text-white text-center">{displayStats.upsetRate}</div>
            <p className="text-xs text-gray-400 text-center">Lower &gt; higher seeds</p>
          </div>
        </div>
      </div>
    )
  }

  // Normal (non-export) view
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Players</h3>
          <Users className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white text-center">{displayStats.totalPlayers}</div>
        <p className="text-xs text-gray-400 text-center">Unique competitors</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Tournaments</h3>
          <Award className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white text-center">{displayStats.totalTournaments}</div>
        <p className="text-xs text-gray-400 text-center">Events in series</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Avg. Entrants</h3>
          <BarChart className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white text-center">{displayStats.averageEntrants}</div>
        <p className="text-xs text-gray-400 text-center">Per tournament</p>
      </div>
      <div className="bg-black rounded border border-gray-800 p-3 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">Upset Rate</h3>
          <TrendingUp className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-xl font-bold text-white text-center">{displayStats.upsetRate}</div>
        <p className="text-xs text-gray-400 text-center">Lower &gt; higher seeds</p>
      </div>
    </div>
  )
}