"use client"

import { useState, useEffect, useRef } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
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
import { MiniTopPerformersTable } from "./mini-top-performers-table"
import { MiniSeedPerformanceTable } from "./mini-seed-performance-table"
import { MiniConsistencyTable } from "./mini-consistency-table"
import { MiniRisingStarsTable } from "./mini-rising-stars-table"
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
    tournamentSlugs?: string[];
  } | null>(null)
  const [seriesName, setSeriesName] = useState("")
  const [tournamentSeriesName, setTournamentSeriesName] = useState("");
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [noData, setNoData] = useState(false)
  const [seriesInputs, setSeriesInputs] = useState([
    { tournamentSeriesName: "", primaryContact: "" },
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const SEASON_PRESETS = [
    { label: "Spring", value: "spring", start: "03-01", end: "05-31" },
    { label: "Summer", value: "summer", start: "06-01", end: "08-31" },
    { label: "Fall", value: "fall", start: "09-01", end: "11-30" },
    { label: "Winter", value: "winter", start: "12-01", end: "02-28" },
  ];
  const YEARS = Array.from({ length: 8 }, (_, i) => 2018 + i);

  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const handleSeasonPreset = (season, year) => {
    if (!season || !year) return;
    const preset = SEASON_PRESETS.find((s) => s.value === season);
    if (!preset) return;
    let start, end;
    if (season === "winter") {
      start = `${year}-12-01`;
      end = `${parseInt(year, 10) + 1}-02-28`;
    } else {
      start = `${year}-${preset.start}`;
      end = `${year}-${preset.end}`;
    }
    setDateRange({ start, end });
  };

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
    setCancelRequested(false);

    // Create a new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
        signal: abortController.signal,
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

      if (
        playerName &&
        playerName.trim() &&
        data?.allPlayerNames?.some(
          n => n?.toLowerCase() === playerName.trim().toLowerCase()
        ) &&
        !(
          data?.topPerformers?.some(
            p => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.risingStars?.some(
            p => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.seedOutperformers?.some(
            p => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.consistentPlayers?.some(
            p => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          )
        )
      ) {
        setTournamentData(null);
        setNoData(false);
        setError("Player does not have enough tournament data. Please adjust your attendance threshold");
        setIsLoading(false);
        return;
      }

    } catch (err) {
      if (err.name === "AbortError" || err.message === "Update cancelled by user") {
        setError("Update cancelled.");
      } else {
        console.error("Error fetching tournament data:", err);
        setError("Failed to load tournament data: " + (err.message || "Unknown error"));
      }
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

  // Ref for the dashboard content
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showDownload, setShowDownload] = useState(false);

  // Show download button after dashboard is generated
  useEffect(() => {
    if (tournamentData && !isLoading && !noData && !error) {
      setShowDownload(true);
    } else {
      setShowDownload(false);
    }
  }, [tournamentData, isLoading, noData, error]);

  // Download handler
  const handleDownloadJPG = async () => {
    const html2canvas = (await import("html2canvas")).default;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 50)); // Wait for DOM update
    if (!dashboardRef.current) return;
    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: "#fff",
      scale: 2,
      useCORS: true,
      windowWidth: dashboardRef.current.scrollWidth,
    });
    setIsExporting(false);
    const link = document.createElement("a");
    link.download = "tournament-dashboard.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <DashboardHeader title={"Smash Ultimate Tournament Dashboard"} />

      <div className="flex flex-col gap-4 items-stretch">
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
                  <InfoPopover text="Filter results to only show data for a specific player tag (case-insensitive). Auto-complete if Series Name is inputted." />
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Optional: Filter by Player Tag (ex. Lui$)"
                    value={playerName}
                    onChange={e => {
                      const value = e.target.value;
                      setPlayerName(value);

                      const allPlayers = [
                        ...(tournamentData?.topPerformers?.map(p => p.name) || []),
                        ...(tournamentData?.risingStars?.map(p => p.name) || []),
                        ...(tournamentData?.seedOutperformers?.map(p => p.name) || []),
                        ...(tournamentData?.consistentPlayers?.map(p => p.name) || []),
                      ];
                      // Remove duplicates and filter by input
                      const uniquePlayers = Array.from(new Set(allPlayers));
                      const filtered = uniquePlayers.filter(name =>
                        name?.toLowerCase().includes(value.toLowerCase()) && value.trim() !== ""
                      );
                      setPlayerSuggestions(filtered.slice(0, 8)); // Limit to 8 suggestions
                      setShowSuggestions(filtered.length > 0);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 100)} // Hide dropdown after click
                    onFocus={e => {
                      if (playerSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    className="border rounded px-3 py-2 text-sm w-full h-10"
                    autoComplete="off"
                  />
                  {showSuggestions && (
                    <ul className="absolute z-10 bg-black border border-gray-300 rounded w-full mt-1 max-h-48 overflow-y-auto shadow">
                      {playerSuggestions.map((suggestion, idx) => (
                        <li
                          key={idx}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                          onMouseDown={() => {
                            setPlayerName(suggestion);
                            setShowSuggestions(false);
                          }}
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
            {/* Date Range Selector */}
            <div>
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
              {/* Seasonal Presets BELOW date range selector, not in a flex row with the date inputs */}
              <div className="flex flex-row gap-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium mb-1">Season</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={selectedSeason}
                    onChange={e => {
                      setSelectedSeason(e.target.value);
                      handleSeasonPreset(e.target.value, selectedYear);
                    }}
                  >
                    <option value="">Select season</option>
                    {SEASON_PRESETS.map(season => (
                      <option key={season.value} value={season.value}>{season.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium mb-1">Year</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={selectedYear}
                    onChange={e => {
                      setSelectedYear(e.target.value);
                      handleSeasonPreset(selectedSeason, e.target.value);
                    }}
                  >
                    <option value="">Select year</option>
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Update Data & Download JPG Buttons */}
        <div className="flex flex-col md:flex-row gap-2 justify-center items-center my-4">
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
          {isLoading && (
            <button
              onClick={() => {
                setCancelRequested(true);
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
              }}
              className="px-4 py-2 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition w-full md:w-auto"
              style={{ marginLeft: "0.5rem" }}
            >
              Cancel Update
            </button>
          )}
          {showDownload && (
            <button
              onClick={handleDownloadJPG}
              className="px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition w-full md:w-auto"
            >
              Download Dashboard as JPG
            </button>
          )}
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
            No tournaments were found in the selected date range. Try expanding your date range or adjusting your series name.
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Content */}
      <div ref={dashboardRef} className="mt-2">
        {isExporting ? (
          // --- EXPORT LAYOUT (for JPG only) ---
          <div
            className="bg-black min-h-screen p-8 flex flex-col items-center"
            style={{ maxWidth: "1600px", minHeight: "900px", width: "100vw", height: "100vh", margin: "0 auto" }}
          >
            {/* Export Title */}
            {activePlayerName && activePlayerName.trim() && (
              <h1 className="text-3xl font-bold text-white mb-6 text-center">
                {activePlayerName}'s{" "}
                {seriesInputs
                  .map((input) =>
                    input.tournamentSeriesName
                      ? input.tournamentSeriesName
                          .split(" ")
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ")
                      : ""
                  )
                  .filter(Boolean)
                  .join(", ")}{" "}
                Stats
              </h1>
            )}

            {/* Stats Cards */}
            <div className="mt-0">
              <StatsCards
                stats={tournamentData.summary} playerName={activePlayerName}
              />
            </div>
            {/* Tables: 2x2 grid, all gray/white text on black */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full max-w-5xl mx-auto">
              {/* Top Performers */}
              <div className="rounded-2xl p-4 ">
                <MiniTopPerformersTable
                  players={tournamentData.topPerformers}
                  filterName={activePlayerName}
                />
              </div>
              {/* Rising Stars */}
              <div className="rounded-2xl p-4 ">
                <MiniRisingStarsTable
                  players={tournamentData.risingStars}
                  filterName={activePlayerName}
                />
              </div>
              {/* Seed Overperformers */}
              <div className="rounded-2xl p-4 ">
                <MiniSeedPerformanceTable
                  players={tournamentData.seedOutperformers}
                  filterName={activePlayerName}
                />
              </div>
              {/* Most Consistent */}
              <div className="rounded-2xl p-4 ">
                <MiniConsistencyTable
                  players={tournamentData.consistentPlayers}
                  filterName={activePlayerName}
                />
              </div>
            </div>
            {/* Queried Tournaments */}
            {tournamentData?.tournamentNames && tournamentData?.tournamentNames.length > 0 && tournamentData?.tournamentSlugs && (
              <div className="mt-12 w-full max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-2 text-center text-white">Queried Tournaments</h2>
                <ul className="pl-0 space-y-1">
                  {tournamentData.tournamentNames.map((name, index) => (
                    <li key={index} className="text-lg text-white list-none">
                      {tournamentData.tournamentSlugs && tournamentData.tournamentSlugs[index] ? (
                        <a
                          href={`https://www.start.gg/${tournamentData.tournamentSlugs[index]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-white"
                        >
                          {name}
                        </a>
                      ) : (
                        name
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          // --- NORMAL DASHBOARD LAYOUT ---
          <>
            {!isLoading && tournamentData && !noData && (
              <>
                <div className="space-y-8 rounded-lg shadow-lg p-6 mt-0">
                  {/* Filters Section */}
                  {/* Remove the colored bar and margin above stats cards */}
                  {/* Stats Cards */}
                  <div className="mt-0">
                    <StatsCards stats={tournamentData.summary} playerName={activePlayerName} />
                  </div>
                  {/* Top Performers & Rising Stars */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-yellow-200 via-pink-100 to-pink-300 rounded-lg p-4 shadow">
                      <h2 className="text-lg font-bold mb-2 text-pink-700 print-or-jpg:block hidden">Top Performers</h2>
                      <TopPerformersTable players={tournamentData.topPerformers} filterName={activePlayerName} />
                    </div>
                    <div className="bg-gradient-to-br from-blue-200 via-green-100 to-green-300 rounded-lg p-4 shadow">
                      <h2 className="text-lg font-bold mb-2 text-green-700 print-or-jpg:block hidden">Rising Stars</h2>
                      <RisingStarsTable players={tournamentData.risingStars} filterName={activePlayerName} />
                    </div>
                  </div>
                  {/* Seed Outperformers & Consistency */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-purple-200 via-indigo-100 to-indigo-300 rounded-lg p-4 shadow">
                      <h2 className="text-lg font-bold mb-2 text-indigo-700 print-or-jpg:block hidden">Seed Outperformers</h2>
                      <SeedPerformanceTable players={tournamentData.seedOutperformers} filterName={activePlayerName} />
                    </div>
                    <div className="bg-gradient-to-br from-orange-200 via-yellow-100 to-yellow-300 rounded-lg p-4 shadow">
                      <h2 className="text-lg font-bold mb-2 text-yellow-700 print-or-jpg:block hidden">Consistency</h2>
                      <ConsistencyTable players={tournamentData.consistentPlayers} filterName={activePlayerName} />
                    </div>
                  </div>
                  {/* Tournament Names */}
                  {tournamentData?.tournamentNames && tournamentData?.tournamentNames.length > 0 && tournamentData?.tournamentSlugs && (
                    <div className="mt-8 w-full max-w-6xl">
                      <h2 className="text-lg font-semibold mb-4 text-blue-700">
                        Queried Tournaments
                      </h2>
                      <ul className="list-disc pl-5 space-y-1">
                        {tournamentData.tournamentNames.map((name, index) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            {tournamentData.tournamentSlugs && tournamentData.tournamentSlugs[index] ? (
                              <a
                                href={`https://www.start.gg/${tournamentData.tournamentSlugs[index]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {name}
                              </a>
                            ) : (
                              name
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
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
          </>
        )}
      </div>
 
    {/* Footer with Methodology Button */}
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <a
        href="https://docs.google.com/document/d/16CJ9wdU3gNshWn7miWuneRUUctJ1c-ri/edit?usp=sharing&ouid=103622397100432987768&rtpof=true&sd=true"
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1 rounded bg-white text-black border border-gray-200 shadow font-medium text-xs transition hover:bg-gray-100"
        style={{ minWidth: "auto" }}
      >
        Methodology
      </a>
    </div>
  </div>
  )
}
