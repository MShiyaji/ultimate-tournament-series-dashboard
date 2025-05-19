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

// API key rotation
const STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
let apiKeyIndex = 0;
function getNextApiKey() {
  const key = STARTGG_API_KEYS[apiKeyIndex % STARTGG_API_KEYS.length];
  apiKeyIndex++;
  return key;
}

async function fetchFromAPI(query: string, variables: Record<string, any>, retries = 3): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const apiKey = getNextApiKey();
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
      // If rate limit, wait and retry with next key
      if (response.status === 429) {
        console.warn(`⚠️ Rate limit hit (attempt ${attempt + 1}/${retries + 1}). Waiting 60 seconds before retry...`);
        await delay(60000);
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

// Query for phase groups (without sets)
const phaseGroupsQuery = `
  query TournamentPhaseGroups($tournamentId: ID!) {
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

// Query for event standings
const eventStandingsQuery = `
  query EventStandings($eventId: ID!) {
    event(id: $eventId) {
      id
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
    console.log(`📊 Total tournaments in cache: ${allTournaments.length}`);
    if (allTournaments.length > 0) {
      console.log("Sample tournament structure:", JSON.stringify(allTournaments[0], null, 2));
    }
  } catch (err) {
    console.error("❌ Failed to parse tournament cache:", err);
    throw new Error("Failed to parse tournament cache");
  }

  // Filter by date
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateFilteredTournaments = allTournaments.filter(t => {
    if (!t.startAt) {
      console.log(`⚠️ Tournament missing startAt: ${t.name}`);
      return false;
    }
    const tournamentDate = new Date(t.startAt * 1000);
    return tournamentDate >= start && tournamentDate <= end;
  });

  allTournaments = dateFilteredTournaments;

  // Series input filtering
  const detailedTournaments = [];
  let seriesMatchCount = 0;

  for (const tournament of allTournaments) {
    let shouldQuery = false;

    if (!seriesInputs || seriesInputs.length === 0) continue;

    for (const input of seriesInputs) {
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

      if ((tournamentSeriesName && nameMatch) || (primaryContact && contactMatch)) {
        shouldQuery = true;
        seriesMatchCount++;
        break;
      }
    }

    if (!shouldQuery) continue;

    try {
      await delay(500);

      // 1. Fetch phase groups for this tournament
      const phaseGroupsData = await fetchFromAPI(phaseGroupsQuery, { tournamentId: tournament.id });
      const tournamentDetail = phaseGroupsData?.tournament;
      if (!tournamentDetail) continue;

      // Only process singles events
      const singlesEvents = (tournamentDetail.events || []).filter((event: { name: string }) =>
        event.name.toLowerCase().includes("singles")
      );

      // 2. For each event, fetch standings and sets for all phase groups (paginated)
      for (const event of singlesEvents) {
        // Fetch standings for this event
        const standingsData = await fetchFromAPI(eventStandingsQuery, { eventId: event.id });
        event.standings = standingsData?.event?.standings || { nodes: [] };

        // Fetch sets for each phase group
        for (const phase of event.phases || []) {
          for (const group of (phase.phaseGroups?.nodes || [])) {
            let allSets = [];
            let page = 1;
            let totalPages = 1;
            do {
              await delay(300); // avoid rate limits
              const setsData = await fetchFromAPI(setsQuery, { phaseGroupId: group.id, page });
              const sets = setsData?.phaseGroup?.sets?.nodes || [];
              totalPages = setsData?.phaseGroup?.sets?.pageInfo?.totalPages || 1;
              allSets = allSets.concat(sets);
              page++;
            } while (page <= totalPages);

            // Attach sets to the group
            group.sets = { nodes: allSets };
          }
        }
      }

      // 3. If playerName is defined, filter sets for this player
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

      if (singlesEvents.length > 0) {
        detailedTournaments.push({
          ...tournamentDetail,
          events: singlesEvents,
          playerSetHistory,
        });
        console.log(`✅ Added tournament with ${singlesEvents.length} singles events: ${tournamentDetail.name}`);
      } else {
        console.log(`❌ No singles events found for: ${tournamentDetail.name}`);
      }
    } catch (error) {
      console.error(`Error fetching details for tournament ${tournament.id}:`, error);
    }
  }

  console.log(`🔍 Tournaments matching series criteria: ${seriesMatchCount}`);
  console.log(`🏆 Final detailed tournaments found: ${detailedTournaments.length}`);

  // Return in the format expected by route.ts and data-processing.ts
  return { tournaments: { nodes: detailedTournaments } };
}
