import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { useState } from "react";

const API_URL = "https://www.start.gg/api/-/gql";

let s3: S3Client | null = null;

// Only initialize S3 if AWS credentials are available
if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKET_NAME = "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";

async function downloadCacheFromS3() {
  if (!s3) {
    throw new Error("S3 not configured");
  }
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
  const response = await s3.send(command);
  
  if (!response.Body) {
    throw new Error("No data received from S3");
  }
  
  const text = await response.Body.transformToString();
  return JSON.parse(text);
}

// Basic tournament query for direct API calls
const basicTournamentQuery = `
  query BasicTournamentInfo($startTimestamp: Timestamp!, $endTimestamp: Timestamp!, $page: Int!) {
    tournaments(query: {
      perPage: 50
      page: $page
      filter: {
        afterDate: $startTimestamp
        beforeDate: $endTimestamp
        videogameIds: [1386]
        minEntrantCount: 8
      }
    }) {
      pageInfo {
        totalPages
        total
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

async function fetchTournamentsFromAPI(startDate: string, endDate: string) {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
  
  const apiKey = process.env.STARTGG_API_KEY;
  if (!apiKey) {
    throw new Error("STARTGG_API_KEY environment variable is required");
  }

  let allTournaments = [];
  let page = 1;
  let totalPages = 1;
  const maxPages = 200; // Limit to avoid hitting 10k entry limit (50 per page * 200 pages = 10k max)

  console.log(`📅 Fetching tournaments from ${startDate} to ${endDate}`);

  do {
    console.log(`📄 Fetching page ${page}...`);
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Client-Version": "20",
        "User-Agent": "TournamentDashboard",
      },
      body: JSON.stringify({
        query: basicTournamentQuery,
        variables: { startTimestamp, endTimestamp, page },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`StartGG API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`StartGG API errors: ${JSON.stringify(data.errors)}`);
    }

    const tournaments = data.data?.tournaments;
    if (tournaments?.nodes) {
      allTournaments.push(...tournaments.nodes);
      console.log(`✅ Page ${page}: Got ${tournaments.nodes.length} tournaments (${allTournaments.length} total)`);
    }
    
    totalPages = Math.min(tournaments?.pageInfo?.totalPages || 1, maxPages);
    page++;

    // Add delay between requests to respect rate limits
    if (page <= totalPages) {
      await delay(200); // Slightly longer delay
    }

    // Safety check to avoid infinite loops
    if (page > maxPages) {
      console.log(`⚠️ Reached maximum page limit (${maxPages}), stopping pagination`);
      break;
    }
  } while (page <= totalPages);

  console.log(`🎯 Total tournaments fetched: ${allTournaments.length}`);
  return allTournaments;
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
        "Authorization": `Bearer ${apiKey}`,
        "Client-Version": "20",
        "User-Agent": "TournamentDashboard",
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
  const chunks: T[][] = Array.from({ length: n }, () => []);
  array.forEach((item, i) => {
    chunks[i % n].push(item);
  });
  return chunks;
}

// Query for fetching tournaments by name with date range
const tournamentByNameQuery = `
  query TournamentsByName($name: String!, $startTimestamp: Timestamp!, $endTimestamp: Timestamp!) {
    tournaments(query: {
      filter: {
        name: $name
        afterDate: $startTimestamp
        beforeDate: $endTimestamp
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
    }
  }
`;

async function fetchTournamentsByName(tournamentNames: string[], startDate: string, endDate: string) {
  const apiKey = process.env.STARTGG_API_KEY;
  if (!apiKey) {
    throw new Error("STARTGG_API_KEY environment variable is required");
  }

  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

  let allTournaments: any[] = [];

  for (const name of tournamentNames) {
    console.log(`🎯 Fetching tournaments with name: "${name}"`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Client-Version": "20",
        "User-Agent": "TournamentDashboard",
      },
      body: JSON.stringify({
        query: tournamentByNameQuery,
        variables: { name, startTimestamp, endTimestamp },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`StartGG API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`StartGG API errors: ${JSON.stringify(data.errors)}`);
    }

    const tournaments = data.data?.tournaments?.nodes || [];
    
    // Filter to more precise matches client-side since StartGG does substring matching
    const filteredTournaments = tournaments.filter((tournament: any) => {
      const tournamentName = tournament.name?.toLowerCase() || "";
      const searchName = name.toLowerCase();
      
      // Check if the tournament name starts with the search term or contains it as a complete word/phrase
      return (
        tournamentName.startsWith(searchName) ||
        tournamentName.includes(searchName + " ") ||
        tournamentName.includes(" " + searchName) ||
        tournamentName === searchName
      );
    });
    
    allTournaments.push(...filteredTournaments);
    console.log(`✅ Found ${tournaments.length} tournaments, filtered to ${filteredTournaments.length} for "${name}"`);

    // Small delay between name searches
    if (tournamentNames.indexOf(name) < tournamentNames.length - 1) {
      await delay(100);
    }
  }

  console.log(`🎯 Total tournaments found by name: ${allTournaments.length}`);
  return allTournaments;
}

export async function fetchberkeleyTournaments(
  startDate: string,
  endDate: string,
  seriesInputs: { tournamentSeriesName: string; primaryContact: string; strictMatch?: boolean; city?: string; countryCode?: string }[],
  playerName: string
) {
  
  // Extract tournament names for name-based search
  const tournamentNames = seriesInputs
    .filter(input => input.tournamentSeriesName?.trim())
    .map(input => input.tournamentSeriesName.trim());

  let tournaments: any[] = [];
  
  if (tournamentNames.length > 0) {
    // 1. Fetch tournaments by name with date range (preferred over broad search)
    console.log("🎯 Using tournament name search with date filtering");
    try {
      tournaments = await fetchTournamentsByName(tournamentNames, startDate, endDate);
    } catch (apiErr) {
      console.error("❌ Failed to fetch tournaments by name:", apiErr);
      throw new Error(`Failed to load tournament data: ${apiErr instanceof Error ? apiErr.message : 'Unknown error'}`);
    }
  } else {
    try {
      if (s3) {
        console.log("🗃️ Attempting to load from S3 cache...");
        const cacheData = await downloadCacheFromS3();
        tournaments = cacheData.tournaments?.nodes || [];
        console.log("✅ Successfully loaded from S3 cache");
      } else {
        throw new Error("S3 not configured, falling back to API");
      }
    } catch (err) {
      console.error("❌ Failed to read from S3 cache, fetching from API:", err);
      try {
        console.log("📡 Fetching tournaments from StartGG API...");
        tournaments = await fetchTournamentsFromAPI(startDate, endDate);
        console.log(`✅ Successfully fetched ${tournaments.length} tournaments from API`);
      } catch (apiErr) {
        console.error("❌ Failed to fetch from API:", apiErr);
        throw new Error(`Failed to load tournament data: ${apiErr instanceof Error ? apiErr.message : 'Unknown error'}`);
      }
    }
  }


  // 2. Additional filtering by primary contact, city, countryCode if needed
  // (Skip for name-based searches since they're already targeted)
  if (tournamentNames.length === 0 && seriesInputs && seriesInputs.length > 0) {
    tournaments = tournaments.filter(tournament => {
      return seriesInputs.some(input => {
        const primaryContact = input.primaryContact?.trim().toLowerCase();
        const city = input.city?.trim().toLowerCase();
        const countryCode = input.countryCode?.trim().toLowerCase();

        let contactMatch = true;
        let cityMatch = true;
        let countryMatch = true;

        if (primaryContact && tournament.primaryContact) {
          contactMatch = tournament.primaryContact.toLowerCase().includes(primaryContact);
        } else if (primaryContact) {
          contactMatch = false;
        }

        if (city && (tournament.city || tournament.location)) {
          cityMatch =
            (tournament.city && tournament.city.toLowerCase().includes(city)) ||
            (tournament.location && tournament.location.toLowerCase().includes(city));
        } else if (city) {
          cityMatch = false;
        }

        if (countryCode && tournament.countryCode) {
          countryMatch = tournament.countryCode.toLowerCase() === countryCode;
        } else if (countryCode) {
          countryMatch = false;
        }

        return contactMatch && cityMatch && countryMatch;
      });
    });
  }

  // 3. Filter events to focus on singles events
  tournaments = tournaments.map(tournament => ({
    ...tournament,
    events: (tournament.events || []).filter((event: any) => {
      const eventName = event.name?.toLowerCase() || "";
      return (
        eventName.includes("singles") ||
        eventName.includes("1v1") ||
        eventName.includes("bracket") ||
        // Include if it doesn't seem to be doubles/teams
        (!eventName.includes("doubles") && !eventName.includes("teams") && !eventName.includes("2v2") && !eventName.includes("crew"))
      );
    }),
  })).filter(t => t.events.length > 0);

  console.log(`🎮 Found ${tournaments.length} tournaments with ${tournaments.reduce((acc, t) => acc + t.events.length, 0)} events total`);

  // 4. Fetch standings for each event
  const apiKey = process.env.STARTGG_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ No STARTGG_API_KEY found, skipping standings fetch");
  } else {
    console.log(`📊 Fetching standings for ${tournaments.reduce((acc, t) => acc + t.events.length, 0)} events...`);
    
    // Process tournaments sequentially to avoid overwhelming the API
    for (const tournament of tournaments) {
      for (const event of tournament.events) {
        try {
          const data = await fetchFromAPI(
            eventStandingsQuery,
            { eventId: event.id },
            apiKey
          );
          event.standings = data?.event?.standings || { nodes: [] };
          
          // Small delay between requests to be respectful
          await delay(50);
        } catch (err) {
          event.standings = { nodes: [] };
          console.error(`❌ Failed to fetch standings for event ${event.id}:`, err);
        }
      }
    }
  }

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

