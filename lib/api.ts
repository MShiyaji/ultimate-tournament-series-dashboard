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

async function fetchFromAPI(query: string, variables: Record<string, any>) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
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

// Tournament-centric query 
const detailQuery = `
  query TournamentDetails($tournamentId: ID!) {
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
        standings(query: { perPage: 64 }) {
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
              sets(perPage: 50, page: 1) {
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
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchAllSetsFromTournamentData(tournamentData) {
  const allSets = [];
  for (const event of tournamentData.events || []) {
    for (const phase of event.phases || []) {
      for (const group of (phase.phaseGroups?.nodes || [])) {
        for (const set of (group.sets?.nodes || [])) {
          allSets.push(set);
        }
      }
    }
  }
  return allSets;
}

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
    
    // Check format of first tournament to verify structure
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
  
  console.log(`📅 After date filter (${startDate} to ${endDate}): ${dateFilteredTournaments.length} tournaments`);
  console.log(`📆 Date range: ${start.toISOString()} to ${end.toISOString()}`);
  
  if (dateFilteredTournaments.length === 0 && allTournaments.length > 0) {
    // Log a sample of dates to debug
    console.log("Sample tournament dates:");
    allTournaments.slice(0, 5).forEach(t => {
      console.log(`- ${t.name}: ${new Date(t.startAt * 1000).toISOString()} (unix: ${t.startAt})`);
    });
  }
  
  allTournaments = dateFilteredTournaments;

  // Series input filtering
  console.log(`🔍 Series inputs:`, seriesInputs);
  
  const detailedTournaments = [];
  let seriesMatchCount = 0;

  for (const tournament of allTournaments) {
    let shouldQuery = false;

    // If no seriesInputs, skip
    if (!seriesInputs || seriesInputs.length === 0) {
      console.log("❌ No series inputs provided, skipping all tournaments");
      continue;
    }

    // Check if tournament matches ANY of the seriesInputs
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
        console.log(`✅ Match found for "${tournament.name}" (series: "${tournamentSeriesName}", contact: "${primaryContact}")`);
        shouldQuery = true;
        seriesMatchCount++;
        break;
      }
    }

    if (!shouldQuery) continue;

    try {
      await delay(500);
      const detailedData = await fetchFromAPI(detailQuery, { tournamentId: tournament.id });
      const detailed = detailedData?.tournament;

      if (!detailed) continue;

      const singlesEvents = detailed.events.filter((event: { name: string }) =>
        event.name.toLowerCase().includes("singles")
      );

      let playerSetHistory = null;
      // If playerName is defined, filter sets for this player from the already-fetched detailQuery data
      if (playerName) {
        const lowerPlayerName = playerName.trim().toLowerCase();
        const filteredEvents = [];

        // Only process events with "singles" in the name
        const events = (detailed.events || []).filter(
          (event: any) => event.name.toLowerCase().includes("singles")
        );

        for (const event of events) {
          const filteredPhases = [];
          for (const phase of event.phases || []) {
            const filteredPhaseGroups = [];
            for (const group of (phase.phaseGroups?.nodes || [])) {
              // Only keep sets where the player participated
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
            ...detailed,
            events: filteredEvents
          };
        } else {
          playerSetHistory = null;
        }
      }

      if (singlesEvents.length > 0) {
        detailedTournaments.push({
          ...detailed,
          events: singlesEvents,
          playerSetHistory,
        });
        console.log(`✅ Added tournament with ${singlesEvents.length} singles events: ${detailed.name}`);
      } else {
        console.log(`❌ No singles events found for: ${detailed.name}`);
      }
    } catch (error) {
      console.error(`Error fetching details for tournament ${tournament.id}:`, error);
    }
  }

  console.log(`🔍 Tournaments matching series criteria: ${seriesMatchCount}`);
  console.log(`🏆 Final detailed tournaments found: ${detailedTournaments.length}`);

  return { tournaments: { nodes: detailedTournaments } };
}
