import { createClient } from "@supabase/supabase-js";

const API_URL = "https://api.start.gg/gql/alpha";
const TOURNAMENT_CACHE_TTL = 1000 * 60 * 10; // 10 minutes

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Adaptive delay helper
function createAdaptiveDelay(initial = 0, min = 0, max = 5000, step = 200) {
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

// Helper: split a date range into N periods
function splitDateRange(start: Date, end: Date, n: number): [Date, Date][] {
  const periods: [Date, Date][] = [];
  const totalMs = end.getTime() - start.getTime();
  for (let i = 0; i < n; i++) {
    const periodStart = new Date(start.getTime() + (totalMs * i) / n);
    const periodEnd = i === n - 1
      ? end
      : new Date(start.getTime() + (totalMs * (i + 1)) / n - 1);
    periods.push([periodStart, periodEnd]);
  }
  return periods;
}

// fetchFromAPI now takes an explicit apiKey and adaptiveDelay
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
        console.warn(`⚠️ Rate limit hit (attempt ${attempt + 1}/${retries + 1}). Waiting 60 seconds before retry...`);
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

// Combined query for phase groups (without sets) AND event standings
const phaseGroupsAndStandingsQuery = `
  query TournamentPhaseGroupsAndStandings($tournamentId: ID!) {
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
        phases {
          id
          name
          phaseGroups {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`;

// Query for sets in a phase group (paginated)
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

export async function fetchberkeleyTournaments(
  startDate: string,
  endDate: string,
  seriesInputs: { tournamentSeriesName: string; primaryContact: string }[],
  playerName: string 
) {
  // Download and parse cache
  const { data: fileData, error } = await supabase
    .storage
    .from("tournament-cache")
    .download("basic-cache.json");

  if (error || !fileData) {
    console.error("❌ Failed to read from Supabase cache:", error);
    throw new Error("Failed to load basic tournament cache");
  }

  let allTournaments: any[] = [];
  try {
    const text = await fileData.text();
    allTournaments = JSON.parse(text);
  } catch (err) {
    throw new Error("Failed to parse tournament cache");
  }

  // 1. Pre-filter tournaments by date and seriesInputs BEFORE making API calls
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Pre-filter tournaments by date
  let filteredTournaments = allTournaments.filter(t => {
    if (!t.startAt) return false;
    const tournamentDate = new Date(t.startAt * 1000);
    return tournamentDate >= start && tournamentDate <= end;
  });

  // Pre-filter tournaments by seriesInputs
  if (seriesInputs && seriesInputs.length > 0) {
    filteredTournaments = filteredTournaments.filter(tournament => {
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

  // 2. Split tournaments into N chunks for parallel API key usage
  const apiKeys = STARTGG_API_KEYS;
  const numKeys = apiKeys.length;
  function chunkArray(array: any[], n: number) {
    const chunks = Array.from({ length: n }, () => []);
    array.forEach((item, i) => {
      chunks[i % n].push(item);
    });
    return chunks;
  }
  const tournamentChunks = chunkArray(filteredTournaments, numKeys);

  // 3. Process each chunk in parallel, one per API key
  const periodPromises = tournamentChunks.map(async (tournaments, idx) => {
    const apiKey = apiKeys[idx];
    const adaptiveDelay = createAdaptiveDelay();
    const detailedTournaments = [];
    for (const tournament of tournaments) {
      try {
        await adaptiveDelay.wait();

        // Fetch phase groups and standings for this tournament
        const phaseGroupsAndStandingsData = await fetchFromAPI(
          phaseGroupsAndStandingsQuery,
          { tournamentId: tournament.id },
          apiKey,
          adaptiveDelay
        );
        const tournamentDetail = phaseGroupsAndStandingsData?.tournament;
        if (!tournamentDetail) continue;

        // Pre-filter events to only singles events
        const singlesEvents = (tournamentDetail.events || []).filter((event: { name: string }) =>
          event.name.toLowerCase().includes("singles")
        );

        // If no singles events, skip this tournament
        if (singlesEvents.length === 0) continue;

        // Fetch sets for all phase groups (paginated) ONLY if playerName is provided
        if (playerName) {
          for (const event of singlesEvents) {
            for (const phase of event.phases || []) {
              for (const group of (phase.phaseGroups?.nodes || [])) {
                let allSets = [];
                let page = 1;
                let totalPages = 1;
                do {
                  await adaptiveDelay.wait();
                  const setsData = await fetchFromAPI(
                    setsQuery,
                    { phaseGroupId: group.id, page },
                    apiKey,
                    adaptiveDelay
                  );
                  const sets = setsData?.phaseGroup?.sets?.nodes || [];
                  totalPages = setsData?.phaseGroup?.sets?.pageInfo?.totalPages || 1;
                  allSets = allSets.concat(sets);
                  page++;
                } while (page <= totalPages);

                group.sets = { nodes: allSets };
              }
            }
          }
        }

        // Filter sets for player if needed (unchanged)
        let playerSetHistory = null;
        if (playerName) {
          const lowerPlayerName = playerName.trim().toLowerCase();
          const filteredEvents = [];

          for (const event of singlesEvents) {
            const filteredPhases = [];
            for (const phase of event.phases || []) {
              const filteredPhaseGroups = [];
              for (const group of (phase.phaseGroups?.nodes || [])) {
                const filteredSets = (group.sets?.nodes || []).filter(set =>
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
            playerSetHistory = {
              ...tournamentDetail,
              events: filteredEvents
            };
          } else {
            playerSetHistory = null;
          }
        }

        detailedTournaments.push({
          ...tournamentDetail,
          events: singlesEvents,
          playerSetHistory,
        });
      } catch (error) {
        console.error(`Error fetching details for tournament ${tournament.id}:`, error);
      }
    }
    return detailedTournaments;
  });

  // Wait for all periods to finish and flatten results
  const allDetailedTournaments = (await Promise.all(periodPromises)).flat();

  return { tournaments: { nodes: allDetailedTournaments } };
}
