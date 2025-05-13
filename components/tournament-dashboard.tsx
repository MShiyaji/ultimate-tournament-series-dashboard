"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DateRangeSelector } from "@/components/date-range-selector"
import { StatsCards } from "@/components/stats-cards"
import { TopPerformersTable } from "@/components/top-performers-table"
import { SeedPerformanceTable } from "@/components/seed-performance-table"
import { ConsistencyTable } from "@/components/consistency-table"
import { RisingStarsTable } from "@/components/rising-stars-table"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { format, subMonths } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { extractSeriesName } from "@/lib/utils"

export function TournamentDashboard() {
  const today = new Date()
  const sixMonthsAgo = subMonths(today, 4)

  const [dateRange, setDateRange] = useState({
    start: format(sixMonthsAgo, "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd"),
  })
  const [primaryContact, setPrimaryContact] = useState("")
  const [playerName, setPlayerName] = useState("");
  const [tournamentData, setTournamentData] = useState<{
    seriesName?: string
    summary?: any
    topPerformers?: any[]
    risingStars?: any[]
    seedOutperformers?: any[]
    consistentPlayers?: any[];
    tournamentNames?: string[];
  } | null>(null)
  const [seriesName, setSeriesName] = useState("")
  const [tournamentSeriesName, setTournamentSeriesName] = useState("");
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [noData, setNoData] = useState(false)

  const fetchData = async () => {
    if (!dateRange.start || !dateRange.end || (!primaryContact.trim() && !tournamentSeriesName.trim())) {
      setError("Please select a date range and enter either a tournament series name or/and a primary contact");
      return;
    }

    setIsLoading(true);
    setError("");
    setNoData(false);

    try {
      console.log("Request Payload:", {
        startDate: dateRange.start,
        endDate: dateRange.end,
        primaryContact: primaryContact.trim(),
        tournamentSeriesName: tournamentSeriesName.trim(),
      });

      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          primaryContact: primaryContact.trim(),
          tournamentSeriesName: tournamentSeriesName.trim(),
          playerName: playerName.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log("API Response:", data);

      if (data.error) throw new Error(data.error);

      if (
        data.noData ||
        (data.topPerformers?.length === 0 &&
        data.seedOutperformers?.length === 0 &&
        data.consistentPlayers?.length === 0)
      ) {
        setNoData(true);
      } else {
        setTournamentData(data); 
      }

    } catch (err) {
      console.error("Error fetching tournament data:", err);
      setError("Failed to load tournament data: " + (err.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }

  // Helper function to filter players by name (case-insensitive)
  const filterByPlayerName = (arr) =>
    playerName.trim()
      ? arr?.filter((p) =>
          p.name?.toLowerCase().includes(playerName.trim().toLowerCase())
        )
      : arr;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <DashboardHeader title={"Smash Ultimate Tournament Dashboard"} />

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
          <input
            type="text"
            placeholder="Enter primary contact (if there are tournaments with varying series names)"
            value={primaryContact}
            onChange={(e) => setPrimaryContact(e.target.value)}
            className="mt-2 w-full border rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Enter tournament series name"
            value={tournamentSeriesName}
            onChange={(e) => setTournamentSeriesName(e.target.value)}
            className="mb-2 w-full border rounded px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Filter by player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="mb-2 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <Button
            onClick={fetchData}
            disabled={isLoading || !dateRange.start || !dateRange.end}
            className="w-full md:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading...
              </>
            ) : (
              "Update Data"
            )}
          </Button>
        </div>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error Message */}
      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Data Message */}
      {noData && !isLoading && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Data Found</AlertTitle>
          <AlertDescription>
            No tournaments were found in the selected date range. Try expanding your date range, or adding missing values.
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Content */}
      {!isLoading && tournamentData && !noData && (
        <div className="space-y-8">
          <StatsCards stats={tournamentData.summary} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopPerformersTable players={tournamentData.topPerformers} filterName={playerName} />
            <RisingStarsTable players={tournamentData.risingStars} filterName={playerName} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SeedPerformanceTable players={tournamentData.seedOutperformers} filterName={playerName} />
            <ConsistencyTable players={tournamentData.consistentPlayers} filterName={playerName} />
          </div>

          {/* Tournament Names */}
          {tournamentData?.tournamentNames && tournamentData?.tournamentNames.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Queried Tournaments</h2>
              <ul className="list-disc pl-5 space-y-1">
                {tournamentData.tournamentNames.map((name, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Default Message */}
      {!isLoading && !error && !noData && !tournamentData && (
        <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
          <p className="mb-4">Select a date range, enter a series name (ex. Guildhouse) and/or primary contact (usually a discord link or TO email in the startgg page header) and click "Update Data"</p>
          <p className="text-sm max-w-md text-center">
            This will retrieve competitor data from all tournaments in that series during the specified time period.
          </p>
        </div>
      )}
    </div>
  )
}
