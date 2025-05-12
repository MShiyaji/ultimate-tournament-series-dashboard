// scripts/cacheDailyTournaments.ts
import { createClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";

const API_URL = "https://api.start.gg/gql/alpha";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

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
    throw new Error("Failed to load cached tournaments");
  }

  const text = await data.text();
  return JSON.parse(text);
}

async function cacheBasicTournaments() {
  const startDate = new Date("2018-01-01");
  const endDate = new Date();
  const chunkSizeDays = 21;

  const allTournaments: any[] = [];
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

      allTournaments.push(...tournaments);
      page++;
    } while (page <= totalPages);

    currentStart = currentEnd;
  }

  console.log(`📦 Collected ${allTournaments.length} tournaments. Uploading...`);

  const { data, error } = await supabase
    .storage
    .from("tournament-cache")
    .upload("basic-cache.json", JSON.stringify(allTournaments), {
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
