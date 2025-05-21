import { Award, Users, BarChart, TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function StatsCards({ stats, playerName }) {
  // Mock data for demonstration
  const mockStats = {
    totalPlayers: 256,
    totalTournaments: 12,
    averageEntrants: 128,
    upsetRate: "18.5%",
    playerEvents: 5,
    playerUpsetRate: "12.3%",
    playerTotalOpponents: 42,
    playerSetGetUpsetRate: "5.2%",
    playerTournaments: 5,
    playerUnique: 42,
  }

  const displayStats = stats || mockStats

  // If filtering by player, show only tournaments attended and unique players
  if (playerName && playerName.trim()) {
    // Use playerTournaments if available, fallback to playerEvents, then totalTournaments
    const tournamentsAttended =
      displayStats.playerTournaments ?? displayStats.playerEvents ?? displayStats.totalTournaments

    // Use playerUnique if available, fallback to playerTotalOpponents, then totalPlayers
    const uniquePlayers =
      displayStats.playerUnique ?? displayStats.playerTotalOpponents ?? displayStats.totalPlayers

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tournaments Attended</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tournamentsAttended}</div>
            <p className="text-xs text-muted-foreground">Events attended by this player</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unique Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniquePlayers}</div>
            <p className="text-xs text-muted-foreground">Unique players in these tournaments</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Otherwise, show normal stats
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Players</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayStats.totalPlayers}</div>
          <p className="text-xs text-muted-foreground">Unique competitors across all tournaments</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayStats.totalTournaments}</div>
          <p className="text-xs text-muted-foreground">Events in the selected series</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Entrants</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayStats.averageEntrants}</div>
          <p className="text-xs text-muted-foreground">Average participants per tournament</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Upset Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayStats.upsetRate}</div>
          <p className="text-xs text-muted-foreground">Lower seeds defeating higher seeds</p>
        </CardContent>
      </Card>
    </div>
  )
}