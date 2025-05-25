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
import { useIsMobile } from "@/hooks/use-mobile"
import { FullListView } from "./full-list-view"

export function TournamentDashboard() {
  const today = new Date()
  const sixMonthsAgo = subMonths(today, 4)
  const isMobile = useIsMobile()

  // Add FAQ tab state
  const [activeTab, setActiveTab] = useState("dashboard") // "dashboard" or "faq"

  const [dateRange, setDateRange] = useState({
    start: format(sixMonthsAgo, "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd"),
  })
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [noData, setNoData] = useState(false)
  const [seriesInputs, setSeriesInputs] = useState([
    { tournamentSeriesName: "", primaryContact: "", city: "", countryCode: "" },
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  // Add new state for city and country autocomplete
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [countrySuggestions, setCountrySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState<{ [key: number]: boolean }>({});
  const [showCountrySuggestions, setShowCountrySuggestions] = useState<{ [key: number]: boolean }>({});

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

  const [queryCooldown, setQueryCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const COOLDOWN_SECONDS = 5;

  const handleSeasonPreset = (season: string, year: string) => {
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

  const handleSeriesInputChange = (idx: number, field: string, value: string | boolean) => {
    setSeriesInputs(inputs =>
      inputs.map((input, i) =>
        i === idx ? { ...input, [field]: value } : input
      )
    );
  };

  const addSeriesInput = () => {
    if (seriesInputs.length < 4) {
      setSeriesInputs([...seriesInputs, { tournamentSeriesName: "", primaryContact: "", city: "", countryCode: "" }]);
    }
  };

  const removeSeriesInput = (idx: number) => {
    setSeriesInputs(inputs => inputs.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (queryCooldown && cooldownRemaining > 0) {
      timer = setTimeout(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            setQueryCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [queryCooldown, cooldownRemaining]);

  const fetchData = async () => {
    if (queryCooldown) return; // Prevent query if in cooldown
    
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
          (n: string) => n?.toLowerCase() === playerName.trim().toLowerCase()
        ) &&
        !(
          data?.topPerformers?.some(
            (p: any) => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.risingStars?.some(
            (p: any) => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.seedOutperformers?.some(
            (p: any) => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          ) ||
          data?.consistentPlayers?.some(
            (p: any) => p.name?.toLowerCase() === playerName.trim().toLowerCase()
          )
        )
      ) {
        setTournamentData(null);
        setNoData(false);
        setError("Player does not have enough tournament data. Please adjust your attendance threshold");
        setIsLoading(false);
        return;
      }

    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "Update cancelled by user") {
        setError("Update cancelled.");
      } else if (
        err.message.includes("429") || 
        err.message.includes("rate limit") || 
        err.message.includes("Too Many Requests")
      ) {
        setError("The service is experiencing high traffic. Please try again in a few minutes.");
      } else {
        console.error("Error fetching tournament data:", err);
        setError("Failed to load tournament data: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
      
      // Set cooldown after query completes
      setQueryCooldown(true);
      setCooldownRemaining(COOLDOWN_SECONDS);
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
    
    // Set to export mode
    setIsExporting(true);
    
    // Wait for DOM update
    await new Promise(r => setTimeout(r, 200));
    
    if (!dashboardRef.current) return;
    
    // Save original styles
    const originalStyle = dashboardRef.current.getAttribute('style') || '';
    
    // Force specific dimensions for export
    dashboardRef.current.style.width = '1024px';
    dashboardRef.current.style.height = '768px';
    dashboardRef.current.style.overflow = 'hidden';
    dashboardRef.current.style.position = 'absolute';
    dashboardRef.current.style.left = '-9999px';
    
    // Create canvas with fixed dimensions
    const canvas = await html2canvas(dashboardRef.current, {
      backgroundColor: "#000",
      scale: 2,
      useCORS: true,
      width: 1024,
      height: 768,
      logging: false,
      allowTaint: true,
    });
    
    // Restore original styling
    dashboardRef.current.setAttribute('style', originalStyle);
    
    // Exit export mode
    setIsExporting(false);
    
    // Create and trigger download
    const link = document.createElement("a");
    link.download = `${activePlayerName ? `${activePlayerName}-` : ''}tournament-dashboard.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  // Popular cities for autocomplete
  const POPULAR_CITIES = [
    "New York", "Sunnyvale", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
    "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Washington",
    "Boston", "El Paso", "Nashville", "Detroit", "Oklahoma City", "Portland", "Las Vegas", "Memphis", "Louisville", "Baltimore",
    "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Sacramento", "Mesa", "Kansas City", "Atlanta", "Long Beach", "Colorado Springs",
    "Raleigh", "Miami", "Virginia Beach", "Omaha", "Oakland", "Minneapolis", "Tulsa", "Arlington", "Tampa", "New Orleans",
    "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Sheffield", "Bristol", "Glasgow", "Leicester", "Edinburgh",
    "Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton", "Mississauga", "Winnipeg", "Quebec City", "Hamilton",
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Newcastle", "Canberra", "Sunshine Coast", "Wollongong",
    "Tokyo", "Osaka", "Kyoto", "Yokohama", "Kobe", "Nagoya", "Sapporo", "Fukuoka", "Hiroshima", "Sendai",
    "Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig",
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Lille"
  ];

  // Countries with their codes
  const COUNTRIES = [
    { code: "US", name: "United States" },
    { code: "CA", name: "Canada" },
    { code: "GB", name: "United Kingdom" },
    { code: "AU", name: "Australia" },
    { code: "JP", name: "Japan" },
    { code: "DE", name: "Germany" },
    { code: "FR", name: "France" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" },
    { code: "NL", name: "Netherlands" },
    { code: "SE", name: "Sweden" },
    { code: "NO", name: "Norway" },
    { code: "DK", name: "Denmark" },
    { code: "FI", name: "Finland" },
    { code: "MX", name: "Mexico" },
    { code: "BR", name: "Brazil" },
    { code: "AR", name: "Argentina" },
    { code: "CL", name: "Chile" },
    { code: "CO", name: "Colombia" },
    { code: "PE", name: "Peru" },
    { code: "KR", name: "South Korea" },
    { code: "CN", name: "China" },
    { code: "TW", name: "Taiwan" },
    { code: "SG", name: "Singapore" },
    { code: "MY", name: "Malaysia" },
    { code: "TH", name: "Thailand" },
    { code: "PH", name: "Philippines" },
    { code: "IN", name: "India" },
    { code: "NZ", name: "New Zealand" },
    { code: "ZA", name: "South Africa" }
  ];

  // Filter cities based on input
  const filterCities = (input: string): string[] => {
    if (!input.trim()) return [];
    return POPULAR_CITIES.filter(city => 
      city.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8);
  };

  // Filter countries based on input (by name or code)
  const filterCountries = (input: string): { code: string; name: string }[] => {
    if (!input.trim()) return [];
    return COUNTRIES.filter(country => 
      country.name.toLowerCase().includes(input.toLowerCase()) ||
      country.code.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8);
  };

  // Add new state for full list view
  const [viewMode, setViewMode] = useState<"dashboard" | "faq" | "fullList">("dashboard");
  const [fullListData, setFullListData] = useState<{
    type: "topPerformers" | "risingStars" | "seedOutperformers" | "consistentPlayers";
    title: string;
    players: any[];
  } | null>(null);

  // Function to show full list
  const showFullList = (type: "topPerformers" | "risingStars" | "seedOutperformers" | "consistentPlayers") => {
    if (!tournamentData) return;
    
    const titles = {
      topPerformers: "Top Performers - Full List",
      risingStars: "Rising Stars - Full List",
      seedOutperformers: "Seed Outperformers - Full List",
      consistentPlayers: "Most Consistent - Full List"
    };
    
    setFullListData({
      type,
      title: titles[type],
      players: tournamentData[type] || []
    });
    setViewMode("fullList");
  };

  // Function to go back to dashboard
  const goBackToDashboard = () => {
    setViewMode("dashboard");
    setFullListData(null);
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-8">
      <div className="relative">
        <DashboardHeader title={"Smash Ultimate Tournament Dashboard"} />
        {/* Below version shows on mobile, hidden on medium screens and up */}
        <div className="text-center text-[10px] text-gray-500 mt-1 md:hidden">
          Made for the community by @Murthrox
        </div>
        {/* This version is hidden on mobile, shows on medium screens and up */}
        <div className="absolute top-0 right-0 text-xs text-gray-500 mt-1 mr-2 hidden md:block">
          Made for the community by @Murthrox
        </div>
      </div>

      {/* Tab Navigation - only show if not in full list view */}
      {viewMode !== "fullList" && (
        <div className="flex justify-center mb-4">
          <div className="flex bg-gray-200 dark:bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                viewMode === "dashboard"
                  ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow"
                  : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode("faq")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                viewMode === "faq"
                  ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow"
                  : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
              }`}
            >
              FAQ
            </button>
          </div>
        </div>
      )}

      {/* Feedback Button - only show if not in full list view */}
      {viewMode !== "fullList" && (
        <div className="flex justify-center mb-3">
          <a
            href="https://forms.gle/N9X1Uo96eN4AjJTd6"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded bg-green-600 text-white font-medium text-sm shadow hover:bg-green-700 transition flex items-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Submit Feedback
          </a>
        </div>
      )}

      {/* Tab Content */}
      {viewMode === "dashboard" ? (
        // DASHBOARD TAB CONTENT
        <>
          <div className="flex flex-col gap-4 items-stretch">
            {/* Find Series Section */}
            <div className="mb-3 md:mb-4">
              <h3 className="font-semibold text-xl md:text-2xl mb-2 md:mb-3">Find Series</h3>
              {seriesInputs.map((input, idx) => (
                <div key={idx} className="mb-3">
                  {isMobile ? (
                    /* MOBILE LAYOUT - Stacked vertically */
                    <div className="flex flex-col gap-2">
                      {/* Series Name - Full width on mobile */}
                      <input
                        type="text"
                        placeholder={`Series Name #${idx + 1}`}
                        value={input.tournamentSeriesName}
                        onChange={e => handleSeriesInputChange(idx, "tournamentSeriesName", e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      
                      {/* Primary Contact with info icon - Full width on mobile */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={`Optional: Primary Contact #${idx + 1}`}
                          value={input.primaryContact}
                          onChange={e => handleSeriesInputChange(idx, "primaryContact", e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm pr-8"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 group cursor-help">
                          <Info className="h-4 w-4 text-gray-400" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                            Primary contact is used when you want to include a tournament within a series that might not have the keyword in it (Ex. Finals Destination in the Berkeley Tournament Series)
                          </div>
                        </div>
                      </div>
                      
                      {/* City and Country Code - Side by side on mobile */}
                      <div className="flex gap-2">
                        {/* City with autocomplete */}
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder={`Optional: City #${idx + 1}`}
                            value={input.city || ""}
                            onChange={e => {
                              const value = e.target.value;
                              handleSeriesInputChange(idx, "city", value);
                              const filtered = filterCities(value);
                              setCitySuggestions(filtered);
                              setShowCitySuggestions(prev => ({ ...prev, [idx]: filtered.length > 0 }));
                            }}
                            onBlur={() => setTimeout(() => setShowCitySuggestions(prev => ({ ...prev, [idx]: false })), 100)}
                            onFocus={() => {
                              if (citySuggestions.length > 0) {
                                setShowCitySuggestions(prev => ({ ...prev, [idx]: true }));
                              }
                            }}
                            className="w-full border rounded px-3 py-2 text-sm"
                            autoComplete="off"
                          />
                          {showCitySuggestions[idx] && (
                            <ul className="absolute z-20 bg-white dark:bg-zinc-800 border border-gray-300 rounded w-full mt-1 max-h-48 overflow-y-auto shadow">
                              {citySuggestions.map((suggestion, sidx) => (
                                <li
                                  key={sidx}
                                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onMouseDown={() => {
                                    handleSeriesInputChange(idx, "city", suggestion);
                                    setShowCitySuggestions(prev => ({ ...prev, [idx]: false }));
                                  }}
                                >
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      
                      {/* Remove button - Full width on mobile if multiple series */}
                      {seriesInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSeriesInput(idx)}
                          className="text-red-500 text-sm py-1 px-2 border border-red-300 rounded self-start"
                        >
                          Remove Series #{idx + 1}
                        </button>
                      )}
                    </div>
                  ) : (
                    /* DESKTOP LAYOUT - More compact horizontal layout */
                    <div className="flex flex-wrap gap-2 items-start">
                      {/* Series Name - Takes more space on desktop */}
                      <input
                        type="text"
                        placeholder={`Series Name #${idx + 1}`}
                        value={input.tournamentSeriesName}
                        onChange={e => handleSeriesInputChange(idx, "tournamentSeriesName", e.target.value)}
                        className="flex-1 min-w-32 border rounded px-3 py-2 text-sm"
                      />
                      
                      {/* Primary Contact with info icon - Reduced width */}
                      <div className="relative flex-1 min-w-32">
                        <input
                          type="text"
                          placeholder={`Optional: Primary Contact #${idx + 1}`}
                          value={input.primaryContact}
                          onChange={e => handleSeriesInputChange(idx, "primaryContact", e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm pr-8"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 group cursor-help">
                          <Info className="h-4 w-4 text-gray-400" />
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                            Primary contact is used when you want to include a tournament within a series that might not have the keyword in it (Ex. Finals Destination in the Berkeley Tournament Series)
                          </div>
                        </div>
                      </div>
                      
                      {/* City - Wider on desktop */}
                      <div className="relative flex-1 min-w-32">
                        <input
                          type="text"
                          placeholder={`Optional: City #${idx + 1}`}
                          value={input.city || ""}
                          onChange={e => {
                            const value = e.target.value;
                            handleSeriesInputChange(idx, "city", value);
                            const filtered = filterCities(value);
                            setCitySuggestions(filtered);
                            setShowCitySuggestions(prev => ({ ...prev, [idx]: filtered.length > 0 }));
                          }}
                          onBlur={() => setTimeout(() => setShowCitySuggestions(prev => ({ ...prev, [idx]: false })), 100)}
                          onFocus={() => {
                            if (citySuggestions.length > 0) {
                              setShowCitySuggestions(prev => ({ ...prev, [idx]: true }));
                            }
                          }}
                          className="w-full border rounded px-3 py-2 text-sm"
                          autoComplete="off"
                        />
                        {showCitySuggestions[idx] && (
                          <ul className="absolute z-20 bg-white dark:bg-zinc-800 border border-gray-300 rounded w-full mt-1 max-h-48 overflow-y-auto shadow">
                            {citySuggestions.map((suggestion, sidx) => (
                              <li
                                key={sidx}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                onMouseDown={() => {
                                  handleSeriesInputChange(idx, "city", suggestion);
                                  setShowCitySuggestions(prev => ({ ...prev, [idx]: false }));
                                }}
                              >
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      
                      {/* Country Code - Wider on desktop */}
                      <div className="relative flex-1 min-w-24">
                        <input
                          type="text"
                          placeholder={`Optional: Country Code #${idx + 1}`}
                          value={input.countryCode || ""}
                          onChange={e => {
                            const value = e.target.value;
                            handleSeriesInputChange(idx, "countryCode", value);
                            const filtered = filterCountries(value);
                            setCountrySuggestions(filtered);
                            setShowCountrySuggestions(prev => ({ ...prev, [idx]: filtered.length > 0 }));
                          }}
                          onBlur={() => setTimeout(() => setShowCountrySuggestions(prev => ({ ...prev, [idx]: false })), 100)}
                          onFocus={() => {
                            if (countrySuggestions.length > 0) {
                              setShowCountrySuggestions(prev => ({ ...prev, [idx]: true }));
                            }
                          }}
                          className="w-full border rounded px-3 py-2 text-sm"
                          maxLength={2}
                          autoComplete="off"
                        />
                        {showCountrySuggestions[idx] && (
                          <ul className="absolute z-20 bg-white dark:bg-zinc-800 border border-gray-300 rounded w-48 mt-1 max-h-48 overflow-y-auto shadow">
                            {filterCountries(input.countryCode || "").map((country, suggestionIdx) => (
                              <li
                                key={suggestionIdx}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs"
                                onMouseDown={() => {
                                  handleSeriesInputChange(idx, "countryCode", country.code);
                                  setShowCountrySuggestions(prev => ({ ...prev, [idx]: false }));
                                }}
                              >
                                <span className="font-mono text-blue-600 dark:text-blue-400">{country.code}</span> - {country.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      
                      {/* Remove button - Compact on desktop */}
                      {seriesInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSeriesInput(idx)}
                          className="text-red-500 text-xs px-2 py-1 border border-red-300 rounded whitespace-nowrap"
                        >
                          Remove
                        </button>
                      )}
                    </div>
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
            <div className="mb-2 bg-gray-100 dark:bg-zinc-900 rounded-lg p-3 md:p-4">
              <h3 className="font-semibold text-base mb-2">Filters</h3>
              <div className="flex flex-col gap-3">
                {/* Player Name + Attendance Ratio */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-1/2">
                    <span className="text-xs font-medium mb-1 flex items-center">
                      Player Tag
                      <div className="relative inline-block ml-1 align-middle group cursor-help">
                        <Info className="h-4 w-4 text-gray-400" />
                        <div className="absolute bottom-full -left-1/2 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                          Filter results to only show data for a specific player tag (case-insensitive). Auto-complete if Series Name is inputted.
                        </div>
                      </div>
                    </span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Optional: Filter by Player Tag"
                        value={playerName}
                        onChange={e => {
                          const value = e.target.value;
                          setPlayerName(value);

                          const allPlayers = [
                            ...(tournamentData?.topPerformers?.map((p: any) => p.name) || []),
                            ...(tournamentData?.risingStars?.map((p: any) => p.name) || []),
                            ...(tournamentData?.seedOutperformers?.map((p: any) => p.name) || []),
                            ...(tournamentData?.consistentPlayers?.map((p: any) => p.name) || []),
                          ];
                          // Remove duplicates and filter by input
                          const uniquePlayers = Array.from(new Set(allPlayers));
                          const filtered = uniquePlayers.filter((name: string) =>
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
                        <ul className="absolute z-10 bg-white dark:bg-black border border-gray-300 rounded w-full mt-1 max-h-48 overflow-y-auto shadow">
                          {playerSuggestions.map((suggestion, idx) => (
                            <li
                              key={idx}
                              className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
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
                  <div className="w-full sm:w-1/2">
                    <span className="text-xs font-medium mb-1 flex items-center">
                      Attendance Threshold (%)
                      <div className="relative inline-block ml-1 align-middle group cursor-help">
                        <Info className="h-4 w-4 text-gray-400" />
                        <div className="absolute bottom-full -left-1/2 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                          Minimum percent of tournaments a player must attend to be included in stats. Default is 25%.
                        </div>
                      </div>
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
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-1/2">
                      <span className="text-xs font-medium mb-1 flex items-center">
                        Start Date
                        <div className="relative inline-block ml-1 align-middle group cursor-help">
                          <Info className="h-4 w-4 text-gray-400" />
                          <div className="absolute bottom-full -left-1/2 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                            Only tournaments starting on or after this date will be included.
                          </div>
                        </div>
                      </span>
                      <input
                        type="date"
                        placeholder="Start Date"
                        value={dateRange.start}
                        onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="border rounded px-3 py-2 text-sm w-full h-10"
                      />
                    </div>
                    <div className="w-full sm:w-1/2">
                      <span className="text-xs font-medium mb-1 flex items-center">
                        End Date
                        <div className="relative inline-block ml-1 align-middle group cursor-help">
                          <Info className="h-4 w-4 text-gray-400" />
                          <div className="absolute bottom-full -left-1/2 mb-2 hidden group-hover:block bg-white dark:bg-zinc-800 p-2 rounded shadow-lg border border-gray-200 dark:border-zinc-700 w-64 text-xs text-gray-600 dark:text-gray-300 z-10">
                            Only tournaments ending on or before this date will be included.
                          </div>
                        </div>
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
                  {/* Seasonal Presets */}
                  <div className="flex flex-row gap-2 mt-1">
                    <div className="flex flex-col w-1/2">
                      <span className="text-xs font-medium mb-1">Season</span>
                      <select
                        className="border rounded px-2 py-2 text-sm"
                        value={selectedSeason}
                        onChange={e => {
                          setSelectedSeason(e.target.value);
                          handleSeasonPreset(e.target.value, selectedYear);
                        }}
                      >
                        <option value=""> Optional: Select season</option>
                        {SEASON_PRESETS.map(season => (
                          <option key={season.value} value={season.value}>{season.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col w-1/2">
                      <span className="text-xs font-medium mb-1">Year</span>
                      <select
                        className="border rounded px-2 py-2 text-sm"
                        value={selectedYear}
                        onChange={e => {
                          setSelectedYear(e.target.value);
                          handleSeasonPreset(selectedSeason, e.target.value);
                        }}
                      >
                        <option value="">Optional: Select year</option>
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
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center my-3 md:my-4">
              <Button
                onClick={fetchData}
                disabled={isLoading || !dateRange.start || !dateRange.end || queryCooldown}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading...
                  </>
                ) : queryCooldown ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Wait {cooldownRemaining}s
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
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition w-full sm:w-auto text-sm"
                >
                  Cancel Update
                </button>
              )}
              {showDownload && (
                <button
                  onClick={handleDownloadJPG}
                  className="px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition w-full sm:w-auto text-sm"
                >
                  Download Dashboard as JPG
                </button>
              )}
            </div>
          </div>

          {/* Loading Spinner */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-500 text-sm">Querying tournaments...</p>
            </div>
          )}

          {/* Error Message */}
          {error && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
                {(error.toLowerCase().includes("rate limit") || 
                  error.toLowerCase().includes("high traffic") || 
                  error.toLowerCase().includes("429")) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Suggestions:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Wait a few minutes before trying again</li>
                      <li>Try narrowing your date range (select fewer months)</li>
                      <li>Reduce the number of tournament series</li>
                      <li>Try during non-peak hours sorry :(</li>
                    </ul>
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
                {tournamentData?.summary?.totalTournaments > 0 && tournamentData?.summary?.totalPlayers === 0 ? (
                  <>
                    No players met the attendance threshold for the tournaments found.<br />
                    <span className="block mt-2">
                      <b>Tip:</b>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                        <li>Try lowering the attendance threshold (set it to 0% or 5%).</li>
                      </ul>
                    </span>
                  </>
                ) : (
                  <>
                    No tournaments were found in the selected date range or for the given series/primary contact.<br />
                    <span className="block mt-2">
                      <b>Tips:</b>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                        <li>Expand your date range to include more tournaments.</li>
                        <li>Check your series name or primary contact for typos.</li>
                      </ul>
                    </span>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard Content */}
          <div ref={dashboardRef} className="mt-2">
            {isExporting ? (
              // --- EXPORT LAYOUT (for JPG only) ---
              <div
                className="bg-black p-6 flex flex-col items-center justify-between"
                style={{ 
                  width: "1024px", 
                  height: "768px", 
                  margin: "0 auto",
                  boxSizing: "border-box",
                  paddingTop: "20px",
                  paddingBottom: "20px",
                  overflow: "hidden"
                }}
              >
                {/* Export Title - Show for both player-specific and general dashboards */}
                <div className="mb-1 w-full">
                  {/* Attribution text above title */}
                  <div className="text-gray-500 text-xs text-center mb-1">
                    Smash Ultimate Tournament Dashboard by @Murthrox
                  </div>
                  
                  <h1 
                    className="text-3xl font-bold text-white mb-0 text-center w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-3 px-4 rounded-md border border-gray-700 flex items-center justify-center" 
                    style={{ 
                      minHeight: "55px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingTop: "2px",
                      paddingBottom: "25px"
                    }}
                  >
                    {activePlayerName && activePlayerName.trim() ? (
                      // Player-specific title
                      <>
                        {activePlayerName}'s{" "}
                        {seriesInputs
                          .filter(input => input.tournamentSeriesName?.trim())
                          .map((input) =>
                            input.tournamentSeriesName
                              .split(" ")
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(" ")
                          )
                          .join(", ")}{" "}
                        Stats
                      </>
                    ) : (
                      // No-player title with explicit fallback text
                      <>
                        {seriesInputs
                          .filter(input => input.tournamentSeriesName?.trim())
                          .map((input) =>
                            input.tournamentSeriesName
                              .split(" ")
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(" ")
                          )
                          .join(", ") || "Tournament"}{" "}
                         Stats
                      </>
                    )}
                  </h1>
                  
                  {/* Date Timeline - Added Below Title */}
                  <div className="text-gray-400 text-sm mb-4 text-center w-full mt-1">
                    {new Date(dateRange.start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}{" "}
                    to{" "}
                    {new Date(dateRange.end).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                
                {/* Stats Cards */}
                <div className="w-full mb-4">
                  <StatsCards
                    stats={tournamentData?.summary} 
                    playerName={activePlayerName}
                    isExporting={true}
                  />
                </div>
                
                {/* Tables: Adjust layout based on whether filtering by player */}
                {activePlayerName && activePlayerName.trim() ? (
                  // PLAYER SPECIFIC - Single column stacked layout
                  <div className="flex flex-col gap-4 w-full mx-auto flex-1">
                    {/* Top Performers */}
                    <div>
                      <MiniTopPerformersTable
                        players={tournamentData?.topPerformers}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Rising Stars */}
                    <div>
                      <MiniRisingStarsTable
                        players={tournamentData?.risingStars}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Seed Outperformers */}
                    <div>
                      <MiniSeedPerformanceTable
                        players={tournamentData?.seedOutperformers}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Most Consistent */}
                    <div>
                      <MiniConsistencyTable
                        players={tournamentData?.consistentPlayers}
                        filterName={activePlayerName}
                      />
                    </div>
                  </div>
                ) : (
                  // GENERAL STATS - 2x2 grid layout
                  <div className="grid grid-cols-2 gap-4 w-full mx-auto flex-1">
                    {/* Top Performers */}
                    <div>
                      <MiniTopPerformersTable
                        players={tournamentData?.topPerformers}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Rising Stars */}
                    <div>
                      <MiniRisingStarsTable
                        players={tournamentData?.risingStars}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Seed Outperformers */}
                    <div>
                      <MiniSeedPerformanceTable
                        players={tournamentData?.seedOutperformers}
                        filterName={activePlayerName}
                      />
                    </div>
                    {/* Most Consistent */}
                    <div>
                      <MiniConsistencyTable
                        players={tournamentData?.consistentPlayers}
                        filterName={activePlayerName}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // --- NORMAL DASHBOARD LAYOUT ---
              <>
                {!isLoading && tournamentData && !noData && (
                  <>
                    <div className="space-y-4 md:space-y-8 rounded-lg shadow-lg p-3 md:p-6 mt-0">
                      {/* Stats Cards */}
                      <div className="mt-0">
                        {activePlayerName && activePlayerName.trim() ? (
                          // Full-width player stats
                          <div className="mb-4 w-full">
                            <h2 className="text-xl font-bold mb-3">{activePlayerName}'s Stats</h2>
                            <StatsCards stats={tournamentData.summary} playerName={activePlayerName} />
                          </div>
                        ) : (
                          // Normal stats display
                          <StatsCards stats={tournamentData.summary} playerName={activePlayerName} />
                        )}
                      </div>
                      {/* Top Performers & Rising Stars */}
                      <div className="grid grid-cols-1 gap-4 md:gap-6">
                        <div className="bg-gradient-to-br from-yellow-200 via-pink-100 to-pink-300 rounded-lg p-3 shadow">
                          <TopPerformersTable 
                            players={tournamentData.topPerformers} 
                            filterName={activePlayerName}
                            onViewFullList={() => showFullList("topPerformers")}
                          />
                        </div>
                        <div className="bg-gradient-to-br from-blue-200 via-green-100 to-green-300 rounded-lg p-3 shadow">
                          <RisingStarsTable 
                            players={tournamentData.risingStars} 
                            filterName={activePlayerName}
                            onViewFullList={() => showFullList("risingStars")}
                          />
                        </div>
                        <div className="bg-gradient-to-br from-purple-200 via-indigo-100 to-indigo-300 rounded-lg p-3 shadow">
                          <SeedPerformanceTable 
                            players={tournamentData.seedOutperformers} 
                            filterName={activePlayerName}
                            onViewFullList={() => showFullList("seedOutperformers")}
                          />
                        </div>
                        <div className="bg-gradient-to-br from-orange-200 via-yellow-100 to-yellow-300 rounded-lg p-3 shadow">
                          <ConsistencyTable 
                            players={tournamentData.consistentPlayers} 
                            filterName={activePlayerName}
                            onViewFullList={() => showFullList("consistentPlayers")}
                          />
                        </div>
                      </div>
                      
                      {/* Tournament Names */}
                      {tournamentData?.tournamentNames && tournamentData?.tournamentNames.length > 0 && tournamentData?.tournamentSlugs && (
                        <div className="mt-6 w-full">
                          <h2 className="text-base md:text-lg font-semibold mb-2 md:mb-4 text-blue-700">
                            Queried Tournaments
                          </h2>
                          <ul className="list-disc pl-4 space-y-1 text-xs md:text-sm">
                            {tournamentData.tournamentNames.map((name, index) => (
                              <li key={index} className="text-muted-foreground">
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
                    <p className="mb-4">Enter a series name (ex. Guildhouse), add additional information to narrow down tournaments, add filters, and click "Update Data"</p>
                    <p className="text-sm max-w-md text-center">
                      This will retrieve competitor data from all tournaments in that series during the specified time period.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with Methodology Button - only show on dashboard tab */}
          {viewMode === "dashboard" && (
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
          )}
        </>
      ) : viewMode === "faq" ? (
        // FAQ TAB CONTENT
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              {/* FAQ Item 1 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: How do I use the dashboard?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: Enter a tournament series name (like "Berkeley" or "Guildhouse"), and hit Update Data. 
                  You can also add a primary contact (usually found in the tournament header on start.gg) to include 
                  tournaments that might not have the series name in the title.
                </p>
              </div>

              {/* FAQ Item 2 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: Can I find all the tournaments within my region?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: While you can't directly find all tournaments in your region, you can add up to four tournament series to approximate your overall region's data.
                </p>
              </div>

              {/* FAQ Item 3 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: The dashboard says there isn't any data for my tournament, but I know I put the series name correctly, what gives?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: It's likely that over the time period selected, there are no players that meet the attendance threshold. Try lowering the threshold from 25%, or expand your date range.
                </p>
              </div>

              {/* FAQ Item 4 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: Help! There are other tournaments by the same name as mine, what do I do?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: You can add the city and/or the country code for your tournament series to help filter out unrelated tournaments. 
                </p>
              </div>

              {/* FAQ Item 5 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: Why am I getting rate limit errors?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: The service may be experiencing high traffic. Try narrowing your date range, 
                  reducing the number of tournament series, or waiting a few minutes before trying again.
                </p>
              </div>

              {/* FAQ Item 6 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: Can I download the results?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: Yes! Once you generate a dashboard, a "Download Dashboard as JPG" button will appear. 
                  This creates a formatted image perfect for sharing on X/Twitter, or other social media. 
                </p>
              </div>

              {/* FAQ Item 7 */}
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold mb-2 text-blue-600 dark:text-blue-400">
                  Q: How do I find the primary contact for a tournament series?
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  A: Go to any tournament in the series on start.gg and look at the header section. 
                  The primary contact is usually listed as a Discord link, email, or social media handle.
                </p>
              </div>
            </div>

            {/* Additional Help */}
            <div className="mt-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Still have questions? Have a suggestion?
              </p>
              <a
                href="https://forms.gle/N9X1Uo96eN4AjJTd6"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded bg-blue-600 text-white font-medium text-sm shadow hover:bg-blue-700 transition"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 mr-2" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Contact Me!
              </a>
            </div>
          </div>
        </div>
      ) : viewMode === "fullList" ? (
        // FULL LIST VIEW
        <FullListView 
          data={fullListData}
          onGoBack={goBackToDashboard}
          filterName={activePlayerName}
        />
      ) : null}
    </div>
  )
}
