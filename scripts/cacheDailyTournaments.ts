// scripts/cacheDailyTournaments.ts
import { addDays } from "date-fns";
import * as dotenv from "dotenv";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
dotenv.config({ path: ".env" });

const API_URL = "https://api.start.gg/gql/alpha";

const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || process.env.STARTGG_API_KEY || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

const s3 = new S3Client({
  region: "us-east-2", // or your region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = "ultimate-tournament-dashboard";
const CACHE_KEY = "basic-cache.json";

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

const tournamentWithStandingsQuery = `
  query TournamentWithStandings($tournamentId: ID!) {
    tournament(id: $tournamentId) {
      id
      name
      slug
      startAt
      numAttendees
      primaryContact
      events(filter: { videogameId: 1386 }) {
        id
        name
        numEntrants
        videogame { id }
        standings(query: { perPage: 128 }) {
          nodes {
            placement
            entrant {
              id
              name
              initialSeedNum
              participants {
                player {
                  id
                  gamerTag
                }
              }
            }
          }
        }
      }
    }
  }
`;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAdaptiveDelay(initial = 200, min = 0, max = 5000, step = 100) {
  let delayMs = initial;
  return {
    async wait() {
      if (delayMs > 0) await delay(delayMs);
    },
    increase() {
      delayMs = Math.min(max, delayMs + step);
    },
    decrease() {
      delayMs = Math.max(min, delayMs - step);
    },
    get value() {
      return delayMs;
    }
  };
}

async function fetchFromAPI(query: string, variables: Record<string, any>, apiKey: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

// Download
async function downloadCache() {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
  const response = await s3.send(command);
  const text = await response.Body.transformToString();
  return JSON.parse(text);
}

// Upload
async function uploadCache(data: any) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: CACHE_KEY,
    Body: JSON.stringify(data),
    ContentType: "application/json",
  });
  await s3.send(command);
}

export async function fetchCachedBasicTournaments(): Promise<any[]> {
  try {
    return await downloadCache();
  } catch (error) {
    console.error("❌ Failed to read from S3 cache:", error);
    throw new Error("Failed to load cached tournaments");
  }
}

// Helper to rotate API keys
function getApiKeyRotator(keys: string[]) {
  let idx = 0;
  return () => {
    const key = keys[idx];
    idx = (idx + 1) % keys.length;
    return key;
  };
}

async function cacheBasicTournaments() {
  let existingTournaments: any[] = [];
  let startFromScratch = false;
  try {
    existingTournaments = await fetchCachedBasicTournaments();
    console.log(`📊 Found existing cache with ${existingTournaments.length} tournaments`);
  } catch (error) {
    console.log("ℹ️ No existing cache found or error accessing it. Creating from scratch.");
    startFromScratch = true;
  }

  let startDate: Date;
  const endDate = new Date();
  if (startFromScratch) {
    startDate = new Date("2018-01-01");
    console.log("🔄 Building complete cache from 2018 to present");
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    console.log(`🔄 Updating cache with tournaments from ${startDate.toLocaleDateString()}`);
  }

  const chunkSizeDays = startFromScratch ? 21 : 1;
  const existingIds = new Set(existingTournaments.map(t => t.id));
  const newTournaments: any[] = [];

  // 1. Build all date chunks first
  let dateChunks: { start: Date; end: Date }[] = [];
  let currentStart = startDate;
  while (currentStart < endDate) {
    const currentEnd = addDays(currentStart, chunkSizeDays);
    dateChunks.push({
      start: new Date(currentStart),
      end: currentEnd > endDate ? new Date(endDate) : new Date(currentEnd),
    });
    currentStart = currentEnd > endDate ? endDate : currentEnd;
  }

  // 2. Split dateChunks among API keys
  function chunkArray<T>(array: T[], n: number): T[][] {
    const chunks = Array.from({ length: n }, () => []);
    array.forEach((item, i) => {
      chunks[i % n].push(item);
    });
    return chunks;
  }
  const dateChunkGroups = chunkArray(dateChunks, STARTGG_API_KEYS.length);

  // 3. Process each group in parallel, one per API key
  await Promise.all(
    dateChunkGroups.map(async (chunks, idx) => {
      const apiKey = STARTGG_API_KEYS[idx];
      for (const { start, end } of chunks) {
        const chunkStartTimestamp = Math.floor(start.getTime() / 1000);
        const chunkEndTimestamp = Math.floor(end.getTime() / 1000);

        let page = 1;
        let totalPages = 1;
        do {
          await delay(1000);
          try {
            const result = await fetchFromAPI(basicQuery, {
              startTimestamp: chunkStartTimestamp,
              endTimestamp: chunkEndTimestamp,
              page,
            }, apiKey);

            const tournaments = result?.tournaments?.nodes || [];
            totalPages = result?.tournaments?.pageInfo?.totalPages || 1;

            for (const tournament of tournaments) {
              if (!existingIds.has(tournament.id)) {
                newTournaments.push(tournament);
                existingIds.add(tournament.id);
              }
            }

            console.log(`✅ [Key ${idx + 1}] Page ${page}/${totalPages}: Found ${tournaments.length} tournaments, ${newTournaments.length} new overall`);
            page++;
          } catch (error) {
            console.error(`❌ [Key ${idx + 1}] Error fetching page ${page}:`, error);
            await delay(5000);
            if (page > 3) {
              console.log("⚠️ Skipping to next chunk after multiple failures");
              break;
            }
          }
        } while (page <= totalPages);
      }
    })
  );

  if (newTournaments.length === 0) {
    console.log("ℹ️ No new tournaments found. Cache is up to date.");
    return;
  }

  console.log(`📦 Found ${newTournaments.length} new tournaments. Updating cache...`);

  // 1. Save the basicQuery results
  const basicTournaments = [...existingTournaments, ...newTournaments];

  // 2. For each tournament, fetch full details and sets with API key rotation and adaptive delay
  const detailedTournaments: any[] = [];
  for (const tournament of basicTournaments) {
    try {
      const data = await fetchFromAPI(
        tournamentWithStandingsQuery,
        { tournamentId: tournament.id },
        getApiKeyRotator(STARTGG_API_KEYS)()
      );
      if (data?.tournament) {
        detailedTournaments.push(data.tournament);
      }
      await delay(500);
    } catch (error) {
      console.error(`Failed to fetch details for tournament ${tournament.id}:`, error);
    }
  }

  // 3. Save both basic and detailed tournaments to S3
  const cacheData = {
    basic: basicTournaments,
    tournaments: { nodes: detailedTournaments }
  };

  try {
    await uploadCache(cacheData);
    console.log(`✅ Cache updated! Now contains ${basicTournaments.length} basic and ${detailedTournaments.length} detailed tournaments`);
  } catch (uploadError) {
    console.error("❌ Failed to upload to S3:", uploadError);

    try {
      const fs = require('fs');
      fs.writeFileSync('./tournament-cache-backup.json', JSON.stringify(cacheData));
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