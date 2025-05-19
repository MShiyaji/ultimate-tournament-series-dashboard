import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const API_URL = "https://api.start.gg/gql/alpha";
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "ultimate-tournament-dashboard";
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

const setsQuery = `
  query PhaseGroupSets($phaseGroupId: ID!, $page: Int!) {
    phaseGroup(id: $phaseGroupId) {
      id
      sets(perPage: 25, page: $page) {
        nodes {
          id
          round
          winnerId
          slots {
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
        pageInfo {
          totalPages
        }
      }
    }
  }
`;

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
        await delay(60000);
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

export async function fetchberkeleyTournaments(
  startDate: string,
  endDate: string,
  seriesInputs: { tournamentSeriesName: string; primaryContact: string }[],
  playerName: string 
) {
  // Download and parse cache from S3
  let cacheData: any = {};
  try {
    cacheData = await downloadCacheFromS3();
  } catch (err) {
    console.error("❌ Failed to read from S3 cache:", err);
    throw new Error("Failed to load tournament cache");
  }

  // Use the detailed tournaments cache
  let tournaments = cacheData.tournaments?.nodes || [];

  // 1. Pre-filter tournaments by date and seriesInputs BEFORE making API calls
  const start = new Date(startDate);
  const end = new Date(endDate);

  tournaments = tournaments.filter(t => {
    if (!t.startAt) return false;
    const tournamentDate = new Date(t.startAt * 1000);
    return tournamentDate >= start && tournamentDate <= end;
  });

  if (seriesInputs && seriesInputs.length > 0) {
    tournaments = tournaments.filter(tournament => {
      return seriesInputs.some(input => {
        const tournamentSeriesName = input.tournamentSeriesName?.trim();
        const primaryContact = input.primaryContact?.trim();
        let nameMatch = false;
        let contactMatch = false;
        if (tournamentSeriesName && tournament.name) {
          nameMatch = tournament.name.toLowerCase().includes(tournamentSeriesName.toLowerCase());
        }
        if (primaryContact && tournament.primaryContact) {
          contactMatch = tournament.primaryContact.toLowerCase().includes(primaryContact.toLowerCase());
        }
        return (tournamentSeriesName && nameMatch) || (primaryContact && contactMatch);
      });
    });
  }

  // If no playerName, return the cached tournaments as is (with sets already included)
  if (!playerName) {
    return { tournaments: { nodes: tournaments } };
  }

  // If playerName is provided, filter sets for the player (using cached sets)
  const lowerPlayerName = playerName.trim().toLowerCase();
  const filteredTournaments = tournaments.map(tournament => {
    const filteredEvents = [];
    for (const event of tournament.events || []) {
      const filteredPhases = [];
      for (const phase of event.phases || []) {
        const filteredPhaseGroups = [];
        for (const group of (phase.phaseGroups?.nodes || [])) {
          // If sets are not cached, fetch them now (shouldn't happen if cache is up to date)
          let sets = (group.sets?.nodes || []);
          // If sets are missing, fetch and cache them on the fly
          if (!sets.length) {
            // Optionally, you could fetch sets here using setsQuery and add them to the group
            // For now, skip groups with no sets
            continue;
          }
          const filteredSets = sets.filter(set =>
            set.slots?.some(slot =>
              slot.entrant?.participants?.some(
                (participant: any) =>
                  participant.player?.gamerTag?.toLowerCase() === lowerPlayerName
              )
            )
          );
          if (filteredSets.length > 0) {
            filteredPhaseGroups.push({
              ...group,
              sets: { nodes: filteredSets }
            });
          }
        }
        if (filteredPhaseGroups.length > 0) {
          filteredPhases.push({
            ...phase,
            phaseGroups: { nodes: filteredPhaseGroups }
          });
        }
      }
      if (filteredPhases.length > 0) {
        filteredEvents.push({
          ...event,
          phases: filteredPhases
        });
      }
    }
    if (filteredEvents.length > 0) {
      return {
        ...tournament,
        events: filteredEvents
      };
    }
    return null;
  }).filter(Boolean);

  return { tournaments: { nodes: filteredTournaments } };
}
