import * as dotenv from "dotenv";
import { downloadCacheFromS3, uploadCache } from "../lib/api";
import { fetchFromAPI } from "../lib/api";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
dotenv.config({ path: ".env" });

const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
const API_URL = "https://api.start.gg/gql/alpha";
const BUCKET_NAME = "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";

// Helper to get date strings
function getMonthRanges(yearsBack: number): { start: string, end: string }[] {
  const now = new Date();
  const ranges = [];
  for (let y = 0; y < yearsBack * 12; y++) {
    const start = new Date(now.getFullYear(), now.getMonth() - y, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    ranges.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
  }
  return ranges.reverse();
}

// Example GraphQL query for tournaments by date (adjust as needed)
const tournamentsByDateQuery = `
  query TournamentsByDate($perPage: Int!, $page: Int!, $afterDate: Timestamp, $beforeDate: Timestamp) {
    tournaments(query: {
      perPage: $perPage,
      page: $page,
      filter: {
        afterDate: $afterDate,
        beforeDate: $beforeDate
      }
    }) {
      nodes {
        id
        name
        slug
        startAt
        city
        countryCode
        events {
          id
          name
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

  // 2. Get month ranges for last 2 years
  const monthRanges = getMonthRanges(2);

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