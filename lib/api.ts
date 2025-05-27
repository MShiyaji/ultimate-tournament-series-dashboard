import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { useState } from "react";

const API_URL = "https://api.start.gg/gql/alpha";
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET_NAME = "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";

async function downloadCacheFromS3() {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
  const response = await s3.send(command);
  const text = await response.Body.transformToString();
  return JSON.parse(text);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAdaptiveDelay(initial = 0, min = 0, max = 5000, step = 100) {
  let delayMs = initial;
  return {
    async wait() {
      await delay(delayMs);
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

const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);

const eventStandingsQuery = `
  query EventStandings($eventId: ID!) {
    event(id: $eventId) {
      id
      standings(query: { perPage: 128 }) {
        nodes {
          placement
          entrant {
            id
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
`;

function getApiKeyRotator(keys: string[]) {
  let idx = 0;
  return () => {
    const key = keys[idx];
    idx = (idx + 1) % keys.length;
    return key;
  };
}

async function fetchFromAPI(query: string, variables: Record<string, any>, apiKey: string, adaptiveDelay?: ReturnType<typeof createAdaptiveDelay>, retries = 3): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
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
      if (response.status === 429) {
        if (adaptiveDelay) adaptiveDelay.increase();
        await delay(1000);
        lastError = new Error(`API request failed with status ${response.status}: ${errorText}`);
        continue;
      }
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    if (adaptiveDelay) adaptiveDelay.decrease();

    const data = await response.json();
    if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join(", "));
    return data.data;
  }
  throw lastError || new Error("API request failed after retries");
}

// Helper to split an array into N chunks
function chunkArray<T>(array: T[], n: number): T[][] {
  const chunks = Array.from({ length: n }, () => []);
  array.forEach((item, i) => {
    chunks[i % n].push(item);
  });
  return chunks;
}

export async function fetchberkeleyTournaments(
  startDate: string,
  endDate: string,
  seriesInputs: { tournamentSeriesName: string; primaryContact: string; strictMatch?: boolean; city?: string; countryCode?: string }[],
  playerName: string,
  // Remove global city/countryCode here, now per-series
) {
  // Download and parse cache from S3
  let cacheData: any = {};
  try {
    cacheData = await downloadCacheFromS3();
  } catch (err) {
    console.error("❌ Failed to read from S3 cache:", err);
    throw new Error("Failed to load tournament cache");
  }

  let tournaments = cacheData.tournaments?.nodes || [];

  // 1. Filter tournaments by date
  const start = new Date(startDate);
  const end = new Date(endDate);

  tournaments = tournaments.filter(t => {
    if (!t.startAt) return false;
    const tournamentDate = new Date(t.startAt * 1000);
    return tournamentDate >= start && tournamentDate <= end;
  });


  // 2. Filter by seriesInputs (series name, primary contact, city, countryCode)
  if (seriesInputs && seriesInputs.length > 0) {
    tournaments = tournaments.filter(tournament => {
      return seriesInputs.some(input => {
        const tournamentSeriesName = input.tournamentSeriesName?.trim().toLowerCase();
        const primaryContact = input.primaryContact?.trim().toLowerCase();
        const strictMatch = !!input.strictMatch;
        const city = input.city?.trim().toLowerCase();
        const countryCode = input.countryCode?.trim().toLowerCase();

        let nameMatch = false;
        let slugMatch = false;
        let contactMatch = false;
        let cityMatch = false;
        let countryMatch = false;

        if (tournamentSeriesName) {
          if (tournament.name) {
            nameMatch = tournament.name.toLowerCase().includes(tournamentSeriesName);
          }
          if (tournament.slug) {
            slugMatch = tournament.slug.toLowerCase().includes(tournamentSeriesName);
          }
        }
        if (primaryContact && tournament.primaryContact) {
          contactMatch = tournament.primaryContact.toLowerCase().includes(primaryContact);
        }
        if (city && (tournament.city || tournament.location)) {
          cityMatch =
            (tournament.city && tournament.city.toLowerCase().includes(city)) ||
            (tournament.location && tournament.location.toLowerCase().includes(city));
        } else if (city && !tournament.city && !tournament.location) {
          cityMatch = false; // If city provided but not in tournament, do not match
        } else {
          cityMatch = true; // If no city filter, always match
        }
        if (countryCode && tournament.countryCode) {
          countryMatch = tournament.countryCode.toLowerCase() === countryCode;
        } else if (countryCode && !tournament.countryCode) {
          countryMatch = false; // If countryCode provided but not in tournament, do not match
        } else {
          countryMatch = true; // If no country filter, always match
        }

        if (strictMatch && tournamentSeriesName && primaryContact) {
          // Require BOTH series name (in name or slug) AND primary contact, plus city/country if provided
          return (nameMatch || slugMatch) && contactMatch && cityMatch && countryMatch;
        } else {
          // Default: series name (in name or slug) OR primary contact, plus city/country if provided
          return (
            ((tournamentSeriesName && (nameMatch || slugMatch)) || (primaryContact && contactMatch)) &&
            cityMatch &&
            countryMatch
          );
        }
      });
    });
  }

  // 3. Filter events to only those with "singles" in the name
  tournaments = tournaments.map(tournament => ({
    ...tournament,
    events: (tournament.events || []).filter(
      (event: any) => event.name && (event.name.toLowerCase().includes("singles") || event.name.toLowerCase().includes() || event.name.toLowerCase().includes("singles bracket") 
    ),
  })).filter(t => t.events.length > 0);

  // 4. Split tournaments among API keys for parallel standings queries
  const apiKeyCount = STARTGG_API_KEYS.length;
  const tournamentChunks = chunkArray(tournaments, apiKeyCount);

  await Promise.all(
    tournamentChunks.map(async (tChunk, idx) => {
      const apiKey = STARTGG_API_KEYS[idx];
      for (const tournament of tChunk) {
        for (const event of tournament.events) {
          try {
            const data = await fetchFromAPI(
              eventStandingsQuery,
              { eventId: event.id },
              apiKey
            );
            event.standings = data?.event?.standings || { nodes: [] };
          } catch (err) {
            event.standings = { nodes: [] };
            console.error(`❌ Failed to fetch standings for event ${event.id}:`, err);
          }
        }
      }
    })
  );

  // 5. If playerName is provided, filter out events and tournaments that don't have standings for the player,
  // but do NOT filter the standings nodes themselves.
  if (playerName) {
    const lowerPlayerName = playerName.trim().toLowerCase();
    tournaments = tournaments.map(tournament => ({
      ...tournament,
      events: tournament.events
        .filter(event =>
          (event.standings?.nodes || []).some(
            (standing: any) =>
              standing.entrant?.participants?.some(
                (participant: any) =>
                  participant.player?.gamerTag?.toLowerCase() === lowerPlayerName
              )
          )
        )
    }))
    .filter(t => t.events.length > 0);
  }

  return { tournaments: { nodes: tournaments } };
}

