import { fetchberkeleyTournaments } from "@/lib/api";
import { processberkeleyData } from "@/lib/data-processing";

type CacheKey = string;
type CacheEntry = {
  timestamp: number;
  data: any; // raw tournament data
};

const basicTournamentCache = new Map<CacheKey, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

function generateCacheKey({
  startDate,
  endDate,
  primaryContact,
  tournamentSeriesName,
  playerName
}: {
  startDate: string;
  endDate: string;
  primaryContact: string;
  tournamentSeriesName: string;
  playerName: string;
}): string {
  return JSON.stringify({ startDate, endDate, primaryContact, tournamentSeriesName, playerName});
}

export async function POST(req: Request) {
  const { startDate, endDate, primaryContact, tournamentSeriesName, playerName} = await req.json();

  if (!startDate || !endDate || (!primaryContact && !tournamentSeriesName)) {
    return new Response("Missing required fields", { status: 400 });
  }

  const cacheKey = generateCacheKey({ startDate, endDate, primaryContact, tournamentSeriesName, playerName});

  let rawTournamentData;

  const cached = basicTournamentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ Using cached tournament data");
    rawTournamentData = { tournaments: { nodes: cached.data } };
  } else {
    console.log("⏳ Fetching fresh tournament data");
    const result = await fetchberkeleyTournaments(startDate, endDate, primaryContact, tournamentSeriesName);
    rawTournamentData = result;
    basicTournamentCache.set(cacheKey, {
      data: result.tournaments.nodes,
      timestamp: Date.now(),
    });
  }

  const processedStats = processberkeleyData(rawTournamentData, playerName);

  return new Response(JSON.stringify(processedStats), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
