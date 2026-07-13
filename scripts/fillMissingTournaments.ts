import * as dotenv from "dotenv";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
dotenv.config({ path: ".env" });

const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
const API_URL = "https://api.start.gg/gql/alpha";
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function downloadCacheFromS3() {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
  const response = await s3.send(command);
  if (!response.Body) throw new Error("No data received from S3");
  const text = await response.Body.transformToString();
  return JSON.parse(text);
}

async function uploadCache(data: any) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: CACHE_KEY,
    Body: JSON.stringify(data),
    ContentType: "application/json",
  });
  await s3.send(command);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromAPI(query: string, variables: Record<string, any>, apiKey: string, retries = 3): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        console.log(`⚠️ Rate limit hit, waiting before retry (attempt ${attempt + 1}/${retries})`);
        await delay(5000 * (attempt + 1));
        lastError = new Error(`API request failed with status ${response.status}: ${errorText}`);
        continue;
      }
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join(", "));
    return data.data;
  }
  throw lastError || new Error("API request failed after retries");
}

// Helper to get date strings
function getMonthRanges(monthsBack: number): { start: string, end: string }[] {
  const now = new Date();
  const ranges = [];
  for (let m = 0; m < monthsBack; m++) {
    const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    ranges.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
  }
  return ranges.reverse();
}

// GraphQL query for tournaments by date (filtered to Smash Ultimate - videogame ID 1386)
const tournamentsByDateQuery = `
  query TournamentsByDate($perPage: Int!, $page: Int!, $afterDate: Timestamp, $beforeDate: Timestamp) {
    tournaments(query: {
      perPage: $perPage,
      page: $page,
      filter: {
        afterDate: $afterDate,
        beforeDate: $beforeDate
        videogameIds: [1386]
      }
    }) {
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
      pageInfo {
        totalPages
      }
    }
  }
`;

async function fetchTournamentIdsInRange(start: string, end: string, apiKey: string): Promise<any[]> {
  let page = 1;
  const perPage = 100;
  let allTournaments: any[] = [];
  let totalPages = 1;
  do {
    const data = await fetchFromAPI(
      tournamentsByDateQuery,
      {
        perPage,
        page,
        afterDate: Math.floor(new Date(start).getTime() / 1000),
        beforeDate: Math.floor(new Date(end).getTime() / 1000)
      },
      apiKey
    );
    const tournaments = data.tournaments?.nodes || [];
    totalPages = data.tournaments?.pageInfo?.totalPages || 1;
    allTournaments = allTournaments.concat(tournaments);
    page++;
  } while (page <= totalPages);
  return allTournaments;
}

async function main() {
  // 1. Download cache
  const cacheData = await downloadCacheFromS3();
  const tournaments: any[] = cacheData?.tournaments?.nodes || [];
  const existingIds = new Set(tournaments.map(t => String(t.id)));

  // 2. Get month ranges for last 3 months
  const monthRanges = getMonthRanges(3);

  // 3. For each month, fetch tournaments and add missing ones
  let added = 0;
  let apiKeyIdx = 0;
  for (const { start, end } of monthRanges) {
    const apiKey = STARTGG_API_KEYS[apiKeyIdx % STARTGG_API_KEYS.length];
    apiKeyIdx++;
    console.log(`🔎 Checking tournaments from ${start} to ${end}...`);
    const found = await fetchTournamentIdsInRange(start, end, apiKey);
    for (const t of found) {
      if (!existingIds.has(String(t.id))) {
        tournaments.push(t);
        existingIds.add(String(t.id));
        added++;
        console.log(`➕ Added missing tournament: ${t.name} (${t.id})`);
      }
    }
  }

  // 4. Upload updated cache
  console.log(`✅ Added ${added} missing tournaments. Uploading updated cache...`);
  await uploadCache({ tournaments: { nodes: tournaments } });
  console.log("🎉 Done!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});