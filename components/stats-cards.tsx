import { Award, TrendingUp, BarChart, Users, ArrowDownCircle } from "lucide-react"

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
    playerUnique: 42, // Add this for demonstration
  }

  const displayStats = stats || mockStats

  // If filtering by player, show player-specific stats
  if (playerName && playerName.trim()) {
    // Use playerTournaments if available, fallback to playerEvents, then totalTournaments
    const eventsAttended =
      displayStats.playerTournaments

    // Use playerUnique if available, fallback to playerTotalOpponents, then totalPlayers
    const uniqueOpponents =
      displayStats.playerUnique 

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Attended</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventsAttended}</div>
            <p className="text-xs text-muted-foreground">Events attended by this player</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Player Upset Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.playerSetUpsetRate ?? displayStats.upsetRate}</div>
            <p className="text-xs text-muted-foreground">Sets won vs higher seeds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Player Get-Upset Rate</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.playerSetGetUpsetRate ?? "0%"}</div>
            <p className="text-xs text-muted-foreground">Sets lost vs lower seeds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Opponents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueOpponents}</div>
            <p className="text-xs text-muted-foreground">Unique players faced</p>
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