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
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";

var basicQuery = `
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
        slug
        startAt
        primaryContact
        city
        countryCode
        events(filter: { videogameId: 1386 }) {
          id
          name
          numEntrants
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

const GITHUB_ACTIONS_MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes
const GITHUB_ACTIONS_MAX_REQUESTS_PER_MIN = 50;

let githubActionsStartTime = Date.now();
let githubActionsRequestCount = 0;
let githubActionsWindowStart = Date.now();

function shouldExitForGithubActionsLimits() {
  // Check runtime
  if (Date.now() - githubActionsStartTime > GITHUB_ACTIONS_MAX_RUNTIME_MS) {
    console.error("⏰ Exiting: Hit GitHub Actions max runtime limit.");
    process.exit(1);
  }
  // Check API request rate
  if (Date.now() - githubActionsWindowStart > 60 * 1000) {
    githubActionsWindowStart = Date.now();
    githubActionsRequestCount = 0;
  }
  if (githubActionsRequestCount >= GITHUB_ACTIONS_MAX_REQUESTS_PER_MIN) {
    const waitMs = 60 * 1000 - (Date.now() - githubActionsWindowStart);
    console.log(`⏳ Hit GitHub Actions API rate limit, waiting ${Math.ceil(waitMs/1000)}s...`);
    return delay(waitMs);
  }
  return Promise.resolve();
}

// Download
async function downloadCache() {
  const command = new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: process.env.AWS_CACHE_KEY });
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
    const cacheData = await downloadCache();
    // Extract the tournaments array from the cache structure
    return cacheData?.tournaments?.nodes || [];
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
    if (!Array.isArray(existingTournaments)) {
      console.log("⚠️ Cache returned non-array data. Treating as empty array.");
      existingTournaments = [];
      startFromScratch = true;
    } else {
      console.log(`📊 Found existing cache with ${existingTournaments.length} tournaments`);
    }
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
    startDate.setDate(startDate.getDate() - 2);
    startDate.setHours(0, 0, 0, 0);
    console.log(`🔄 Updating cache with tournaments from ${startDate.toLocaleDateString()}`);
  }

  const chunkSizeDays = startFromScratch ? 21 : 1;
  const existingIds = new Set(existingTournaments.map(t => t.id));
  const newTournaments: any[] = [];

  // --- Add this block for weekly 30-day lookback ---
  // If today is Sunday (0) or Monday (1), add a 30-day lookback chunk
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  let lookbackChunk: { start: Date; end: Date } | null = null;
  if (dayOfWeek === 0 || dayOfWeek === 1) {
    const lookbackStart = new Date(today);
    lookbackStart.setDate(today.getDate() - 30);
    lookbackStart.setHours(0, 0, 0, 0);
    lookbackChunk = { start: lookbackStart, end: new Date(today) };
    console.log("🔁 Weekly lookback: Adding extra chunk for the last 30 days.");
  }
  // --- End of new block ---

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

  // --- Add the lookback chunk if needed ---
  if (lookbackChunk) {
    dateChunks.push(lookbackChunk);
  }
  // --- End of addition ---

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
          // Add a heartbeat log to prevent timeouts
          if (page % 3 === 0) {
            console.log(`💓 Still processing - Key ${idx + 1}, Page ${page}/${totalPages}`);
          }
          
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
              // Validate the tournament has a valid ID
              if (!tournament.id) {
                console.warn("⚠️ Skipping tournament without ID:", tournament.name || "Unknown");
                continue;
              }
              
              // Ensure it's not already in our set (already synchronized for deduplication)
              if (!existingIds.has(tournament.id)) {
                newTournaments.push(tournament);
                existingIds.add(tournament.id); // Immediately mark as processed
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

  if (newTournaments.length > 0) {
    console.log(`📦 Found ${newTournaments.length} new tournaments. Updating cache...`);
    
    // Create deduplicated merged array by using tournament ID as the key
    const tournamentMap = new Map();
    
    // First add existing tournaments to the map
    for (const tournament of existingTournaments) {
      if (tournament.id) {
        tournamentMap.set(tournament.id, tournament);
      }
    }
    
    // Then add new tournaments, overwriting any with the same ID
    for (const tournament of newTournaments) {
      if (tournament.id) {
        tournamentMap.set(tournament.id, tournament);
      }
    }
    
    // Convert map back to array
    const basicTournaments = Array.from(tournamentMap.values());
    
    // Save to S3
    const cacheData = {
      tournaments: { nodes: basicTournaments }
    };

    console.log(`ℹ️ After deduplication: ${basicTournaments.length} total tournaments (${basicTournaments.length - existingTournaments.length} added)`);

    try {
      await uploadCache(cacheData);
      console.log(`✅ Cache updated! Now contains ${basicTournaments.length} tournaments`);
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
  } else {
    console.log("ℹ️ No new tournaments found. Cache is up to date.");
  }
}

// In fetchFromAPI, increment the request count and check limits:
async function fetchFromAPI(query: string, variables: Record<string, any>, apiKey: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await shouldExitForGithubActionsLimits(); // <-- Add this line
    githubActionsRequestCount++; // <-- Increment for each API call
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          console.log(`⚠️ Rate limit hit, waiting longer before retry (attempt ${attempt}/${retries})`);
          await delay(10000 * attempt); // Progressive backoff
          continue;
        }
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join(", "));

      return data.data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏱️ Request timed out (attempt ${attempt}/${retries})`);
      } else {
        console.error(`❌ API error (attempt ${attempt}/${retries}):`, error.message);
      }
      
      if (attempt === retries) throw error;
      
      // Add exponential backoff
      await delay(Math.min(2000 * Math.pow(2, attempt), 30000));
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