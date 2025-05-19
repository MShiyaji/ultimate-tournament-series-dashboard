// scripts/cacheDailyTournaments.ts
import { createClient } from "@supabase/supabase-js";
import { addDays, subDays } from "date-fns";

const API_URL = "https://api.start.gg/gql/alpha";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const basicQuery = `
  query BasicTournamentInfo($startTimestamp: Timestamp!, $endTimestamp: Timestamp!, $page: Int!) {
    tournaments(query: {
      perPage: 100
      page: $page
      filter: {
        afterDate: $startTimestamp
        beforeDate: $endTimestamp
        videogameIds: [1386]
      }
    }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        name
        primaryContact
        startAt
      }
    }
  }
`;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromAPI(query: string, variables: Record<string, any>) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join(", "));

  return data.data;
}

export async function fetchCachedBasicTournaments(): Promise<any[]> {
  const { data, error } = await supabase
    .storage
    .from("tournament-cache")
    .download("basic-cache.json");

  if (error) {
    console.error("❌ Failed to read from Supabase cache:", error);
    return [];
  }

  const text = await data.text();
  return JSON.parse(text);
}

async function cacheBasicTournaments() {
  const existingTournaments = await fetchCachedBasicTournaments();
  const existingIds = new Set(existingTournaments.map(t => t.id));
  
  // If cache is empty, start from much earlier
  const startDate = existingTournaments.length > 0 
    ? subDays(new Date(), 1) // If cache exists, just add yesterday
    : new Date('2018-01-01'); // Otherwise start from 2018 (or whenever is appropriate)
  
  const endDate = new Date(); // today
  const chunkSizeDays = existingTournaments.length > 0 ? 1 : 30; // Use larger chunks for initial build
  
  const newTournaments: any[] = [];
  let currentStart = startDate;

  while (currentStart < endDate) {
    const currentEnd = addDays(currentStart, chunkSizeDays);
    const chunkStartTimestamp = Math.floor(currentStart.getTime() / 1000);
    const chunkEndTimestamp = Math.floor(currentEnd.getTime() / 1000);

    let page = 1;
    let totalPages = 1;

    do {
      await delay(1000);
      const result = await fetchFromAPI(basicQuery, {
        startTimestamp: chunkStartTimestamp,
        endTimestamp: chunkEndTimestamp,
        page,
      });

      const tournaments = result?.tournaments?.nodes || [];
      totalPages = result?.tournaments?.pageInfo?.totalPages || 1;

      for (const t of tournaments) {
        if (!existingIds.has(t.id)) {
          newTournaments.push(t);
        }
      }

      page++;
    } while (page <= totalPages);

    currentStart = currentEnd;
  }

  const updatedTournaments = [...existingTournaments, ...newTournaments];

  console.log(`📦 Merged total tournaments: ${updatedTournaments.length}`);

  const { data, error } = await supabase
    .storage
    .from("tournament-cache")
    .upload("basic-cache.json", JSON.stringify(updatedTournaments), {
      upsert: true,
      contentType: "application/json",
    });

  if (error) {
    console.error("❌ Upload failed:", error);
    process.exit(1);
  }

  console.log("✅ Basic tournament cache uploaded:", data);
}

// Run only if this file is called directly
if (require.main === module) {
  cacheBasicTournaments().catch((err) => {
    console.error("❌ Script error:", err);
    process.exit(1);
  });
}