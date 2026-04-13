// scripts/populatePlayerUrls.ts
import * as dotenv from "dotenv";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
dotenv.config({ path: ".env" });

const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || process.env.STARTGG_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean);
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
        console.log(`⚠️ Rate limit hit, waiting before retry...`);
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

async function fetchPlayerSlugs(playerIds: string[], apiKey: string) {
  // Use GraphQL aliases to batch fetch player user slugs
  const subQueries = playerIds.map((id, index) => {
    return `p${index}: player(id: "${id}") { id user { slug } }`;
  });
  
  const query = `query BatchPlayers { ${subQueries.join("\n")} }`;
  
  try {
    const data = await fetchFromAPI(query, {}, apiKey);
    const results: Record<string, string> = {};
    Object.values(data).forEach((p: any) => {
      if (p && p.id && p.user?.slug) {
        results[p.id] = p.user.slug.replace("user/", "");
      }
    });
    return results;
  } catch (error) {
    console.error("❌ Batch fetch failed:", error);
    return {};
  }
}

async function main() {
  if (STARTGG_API_KEYS.length === 0) {
    throw new Error("STARTGG_API_KEYS environment variable is required");
  }

  console.log("📥 Downloading cache from S3...");
  const cacheData = await downloadCacheFromS3();
  const tournaments = cacheData?.tournaments?.nodes || [];
  
  const playerIdsToFetch = new Set<string>();
  const totalTournaments = tournaments.length;
  
  console.log(`🔍 Scanning ${totalTournaments} tournaments for players without slugs...`);
  
  // 1. Identify all players missing slugs
  tournaments.forEach((t: any) => {
    t.events?.forEach((e: any) => {
      e.standings?.nodes?.forEach((s: any) => {
        const player = s.entrant?.participants?.[0]?.player;
        if (player && player.id && !player.user?.slug) {
          playerIdsToFetch.add(String(player.id));
        }
      });
    });
  });

  const idsArr = Array.from(playerIdsToFetch);
  console.log(`🎯 Found ${idsArr.length} unique players needing slugs.`);
  
  if (idsArr.length === 0) {
    console.log("✅ No missing slugs found. Exiting.");
    return;
  }

  // 2. Fetch slugs in batches
  const batchSize = 100;
  let apiKeyIdx = 0;
  const slugMap: Record<string, string> = {};
  
  for (let i = 0; i < idsArr.length; i += batchSize) {
    const batch = idsArr.slice(i, i + batchSize);
    const apiKey = STARTGG_API_KEYS[apiKeyIdx % STARTGG_API_KEYS.length];
    apiKeyIdx++;
    
    console.log(`📦 Fetching batch ${Math.floor(i/batchSize)+1}/${Math.ceil(idsArr.length/batchSize)} (${batch.length} players)...`);
    const batchResults = await fetchPlayerSlugs(batch, apiKey);
    Object.assign(slugMap, batchResults);
    
    // Safety delay
    await delay(500);
  }

  console.log(`✅ Successfully fetched ${Object.keys(slugMap).length} slugs.`);

  // 3. Update the cache data
  let updatedCount = 0;
  tournaments.forEach((t: any) => {
    t.events?.forEach((e: any) => {
      e.standings?.nodes?.forEach((s: any) => {
        const player = s.entrant?.participants?.[0]?.player;
        if (player && player.id && !player.user?.slug) {
          const slug = slugMap[String(player.id)];
          if (slug) {
            if (!player.user) player.user = {};
            player.user.slug = `user/${slug}`;
            updatedCount++;
          }
        }
      });
    });
  });

  console.log(`📝 Updated ${updatedCount} player entries in the local cache.`);

  // 4. Upload updated cache
  if (updatedCount > 0) {
    console.log("📤 Uploading updated cache to S3...");
    await uploadCache({ tournaments: { nodes: tournaments } });
    console.log("🎉 All done!");
  } else {
    console.log("ℹ️ No updates made to the cache.");
  }
}

main().catch(error => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
