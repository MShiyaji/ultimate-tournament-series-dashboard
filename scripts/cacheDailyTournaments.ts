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
  // Check if cache already exists
  let existingTournaments: any[] = [];
  let startFromScratch = false;
  
  try {
    existingTournaments = await fetchCachedBasicTournaments();
    console.log(`📊 Found existing cache with ${existingTournaments.length} tournaments`);
  } catch (error) {
    console.log("ℹ️ No existing cache found or error accessing it. Creating from scratch.");
    startFromScratch = true;
  }
  
  // Set date range based on whether cache exists
  let startDate: Date;
  const endDate = new Date(); // today
  
  if (startFromScratch) {
    // If starting from scratch, get all tournaments since 2018
    startDate = new Date("2018-01-01");
    console.log("🔄 Building complete cache from 2018 to present");
  } else {
    // If cache exists, only get yesterday's tournaments
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // yesterday
    startDate.setHours(0, 0, 0, 0); // start of yesterday
    
    console.log(`🔄 Updating cache with tournaments from ${startDate.toLocaleDateString()}`);
  }
  
  const chunkSizeDays = startFromScratch ? 21 : 1; // Smaller chunk for daily updates
  
  // Create a Set of existing tournament IDs for deduplication
  const existingIds = new Set(existingTournaments.map(t => t.id));
  const newTournaments: any[] = [];
  let currentStart = startDate;

  while (currentStart < endDate) {
    const currentEnd = addDays(currentStart, chunkSizeDays);
    if (currentEnd > endDate) {
      // Don't go beyond today
      currentEnd.setTime(endDate.getTime());
    }
    
    console.log(`📅 Processing tournaments from ${currentStart.toLocaleDateString()} to ${currentEnd.toLocaleDateString()}`);
    
    const chunkStartTimestamp = Math.floor(currentStart.getTime() / 1000);
    const chunkEndTimestamp = Math.floor(currentEnd.getTime() / 1000);

    let page = 1;
    let totalPages = 1;

    do {
      await delay(1000);
      try {
        const result = await fetchFromAPI(basicQuery, {
          startTimestamp: chunkStartTimestamp,
          endTimestamp: chunkEndTimestamp,
          page,
        });

        const tournaments = result?.tournaments?.nodes || [];
        totalPages = result?.tournaments?.pageInfo?.totalPages || 1;

        // Add only tournaments that don't already exist in the cache
        for (const tournament of tournaments) {
          if (!existingIds.has(tournament.id)) {
            newTournaments.push(tournament);
            existingIds.add(tournament.id); // Track this ID to avoid duplicates
          }
        }
        
        console.log(`✅ Page ${page}/${totalPages}: Found ${tournaments.length} tournaments, ${newTournaments.length} new overall`);
        page++;
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        // Wait a bit longer before retry on error
        await delay(5000);
        // If we keep failing, move on after 3 attempts
        if (page > 3) {
          console.log("⚠️ Skipping to next chunk after multiple failures");
          break;
        }
      }
    } while (page <= totalPages);

    currentStart = currentEnd;
  }

  if (newTournaments.length === 0) {
    console.log("ℹ️ No new tournaments found. Cache is up to date.");
    return;
  }

  console.log(`📦 Found ${newTournaments.length} new tournaments. Updating cache...`);

  // Merge existing and new tournaments
  const mergedTournaments = [...existingTournaments, ...newTournaments];
  
  try {
    const { data, error } = await supabase
      .storage
      .from("tournament-cache")
      .upload("basic-cache.json", JSON.stringify(mergedTournaments), {
        upsert: true,
        contentType: "application/json",
      });

    if (error) {
      console.error("❌ Upload failed:", error);
      process.exit(1);
    }

    console.log(`✅ Cache updated! Now contains ${mergedTournaments.length} tournaments`);
  } catch (uploadError) {
    console.error("❌ Failed to upload to Supabase:", uploadError);
    
    // Fallback: Save to local file if Supabase fails
    try {
      const fs = require('fs');
      fs.writeFileSync('./tournament-cache-backup.json', JSON.stringify(mergedTournaments));
      console.log("⚠️ Saved to local backup file instead: ./tournament-cache-backup.json");
    } catch (fsError) {
      console.error("❌ Even local backup failed:", fsError);
    }
  }
}

// Run only if this file is called directly
if (require.main === module) {
  cacheBasicTournaments().catch((err) => {
    console.error("❌ Script error:", err);
    process.exit(1);
  });
}