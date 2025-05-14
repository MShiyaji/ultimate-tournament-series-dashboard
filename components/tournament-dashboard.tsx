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

// Helper component for info popover
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-block ml-1 align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      tabIndex={0}
    >
      <button
        type="button"
        aria-label="Info"
        className="text-gray-400 hover:text-gray-600 focus:outline-none p-0 m-0"
        tabIndex={-1}
        style={{ lineHeight: 0 }}
      >
        <Info className="inline h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute z-20 left-full top-0 -translate-y-full ml-2 w-72 rounded-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg p-3 text-xs text-gray-800 dark:text-gray-200"
          style={{ minWidth: "16rem", maxWidth: "20rem", whiteSpace: "normal" }}
        >
          {text}
        </div>
      )}
    </span>
  )
}

export function TournamentDashboard() {
  const today = new Date()
  const sixMonthsAgo = subMonths(today, 4)

  const [dateRange, setDateRange] = useState({
    start: format(sixMonthsAgo, "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd"),
  })
  const [primaryContact, setPrimaryContact] = useState("")
  const [playerName, setPlayerName] = useState("");
  const [activePlayerName, setActivePlayerName] = useState("");
  const [attendanceRatio, setAttendanceRatio] = useState(""); // was 0.25
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
  const [seriesInputs, setSeriesInputs] = useState([
    { tournamentSeriesName: "", primaryContact: "" },
  ]);

  const handleSeriesInputChange = (idx, field, value) => {
    setSeriesInputs(inputs =>
      inputs.map((input, i) =>
        i === idx ? { ...input, [field]: value } : input
      )
    );
  };

  const addSeriesInput = () => {
    if (seriesInputs.length < 4) {
      setSeriesInputs([...seriesInputs, { tournamentSeriesName: "", primaryContact: "" }]);
    }
  };

  const removeSeriesInput = (idx) => {
    setSeriesInputs(inputs => inputs.filter((_, i) => i !== idx));
  };

  const fetchData = async () => {
    if (!dateRange.start || !dateRange.end || seriesInputs.every(s => !s.tournamentSeriesName.trim() && !s.primaryContact.trim())) {
      setError("Please select a date range and enter at least one tournament series name or primary contact");
      return;
    }

    setIsLoading(true);
    setError("");
    setNoData(false);

    try {
      setActivePlayerName(playerName);

      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          seriesInputs,
          playerName: playerName.trim(),
          attendanceRatio: attendanceRatio === "" ? 0.25 : Number(attendanceRatio),
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

  const filterByPlayerName = (arr) =>
    activePlayerName.trim()
      ? arr?.filter((p) =>
          p.name?.toLowerCase().includes(activePlayerName.trim().toLowerCase())
        )
      : arr;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <DashboardHeader title={"Smash Ultimate Tournament Dashboard"} />

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          {/* Find Series Section */}
          <div className="mb-4">
            <h3 className="font-semibold text-2xl mb-3">Find Series</h3>
            {seriesInputs.map((input, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder={`Tournament Series Name #${idx + 1}`}
                  value={input.tournamentSeriesName}
                  onChange={e => handleSeriesInputChange(idx, "tournamentSeriesName", e.target.value)}
                  className="w-1/2 border rounded px-4 py-3 text-base"
                />
                <input
                  type="text"
                  placeholder={`Primary Contact #${idx + 1} (optional)`}
                  value={input.primaryContact}
                  onChange={e => handleSeriesInputChange(idx, "primaryContact", e.target.value)}
                  className="w-1/2 border rounded px-4 py-3 text-base"
                />
                {seriesInputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSeriesInput(idx)}
                    className="text-red-500 text-xs ml-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {seriesInputs.length < 4 && (
              <button
                type="button"
                onClick={addSeriesInput}
                className="mt-1 px-4 py-2 rounded bg-white text-black border border-gray-300 shadow-sm font-medium transition hover:bg-gray-100"
              >
                + Add Another Series
              </button>
            )}
          </div>

          {/* Filters Section */}
          <div className="mb-2 bg-gray-100 dark:bg-zinc-900 rounded-lg p-4">
            <h3 className="font-semibold text-base mb-2">Filters</h3>
            <div className="flex flex-col md:flex-row md:gap-4">
              {/* Player Name + Attendance Ratio */}
              <div className="flex flex-1 flex-row gap-2 mb-2 md:mb-0">
                <div className="flex flex-col w-1/2">
                  <span className="text-xs font-medium mb-1 flex items-center">
                    Player Tag
                    <InfoPopover text="Filter results to only show data for a specific player tag (case-insensitive)." />
                  </span>
                  <input
                    type="text"
                    placeholder="Optional: Filter by Player Tag (ex. Lui$)"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full h-10"
                  />
                </div>
                <div className="flex flex-col w-1/2">
                  <span className="text-xs font-medium mb-1 flex items-center">
                    Attendance Threshold (%)
                    <InfoPopover text="Minimum percent of tournaments a player must attend to be included in stats. Default is 25%." />
                  </span>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    max="100"
                    placeholder="(Default: 25%)"
                    value={attendanceRatio === "" ? "" : String(Number(attendanceRatio) * 100)}
                    onChange={e => {
                      // Convert percent input to ratio for state
                      const val = e.target.value;
                      if (val === "") {
                        setAttendanceRatio("");
                      } else {
                        const num = Math.max(0, Math.min(100, Number(val)));
                        setAttendanceRatio((num / 100).toString());
                      }
                    }}
                    className="border rounded px-3 py-2 text-sm w-full h-10"
                  />
                </div>
              </div>
              {/* Start Date + End Date */}
              <div className="flex flex-1 flex-row gap-2">
                <div className="flex flex-col w-1/2">
                  <span className="text-xs font-medium mb-1 flex items-center">
                    Start Date
                    <InfoPopover text="Only tournaments starting on or after this date will be included." />
                  </span>
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={dateRange.start}
                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full h-10"
                  />
                </div>
                <div className="flex flex-col w-1/2">
                  <span className="text-xs font-medium mb-1 flex items-center">
                    End Date
                    <InfoPopover text="Only tournaments ending on or before this date will be included." />
                  </span>
                  <input
                    type="date"
                    placeholder="End Date"
                    value={dateRange.end}
                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full h-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full flex justify-center mt-2">
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
          <AlertDescription>
            {error}
            {error.toLowerCase().includes("rate limit") && (
              <div className="mt-2 text-xs text-muted-foreground">
                The API is currently overloaded. Please wait a minute and try again. If this happens repeatedly, try narrowing your date range or reducing the number of series.
              </div>
            )}
          </AlertDescription>
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
            <TopPerformersTable players={tournamentData.topPerformers} filterName={activePlayerName} />
            <RisingStarsTable players={tournamentData.risingStars} filterName={activePlayerName} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SeedPerformanceTable players={tournamentData.seedOutperformers} filterName={activePlayerName} />
            <ConsistencyTable players={tournamentData.consistentPlayers} filterName={activePlayerName} />
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
