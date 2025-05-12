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
`;

export async function fetchberkeleyTournaments(startDate: string, endDate: string, primaryContact: string, tournamentSeriesName: string) {
  const { data: fileData, error } = await supabase
    .storage
    .from("tournament-cache")
    .download("basic-cache.json");

  if (error || !fileData) {
    console.error("❌ Failed to read from Supabase cache:", error);
    throw new Error("Failed to load basic tournament cache");
  }

  const text = await fileData.text();
  const allTournaments: any[] = JSON.parse(text).filter(t => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tournamentDate = new Date(t.startAt * 1000); // convert Unix to Date
  return tournamentDate >= start && tournamentDate <= end;
});
  const detailedTournaments = [];

  for (const tournament of allTournaments) {
    let shouldQuery = true;

    if (tournamentSeriesName && primaryContact) {
      if (tournament.name?.toLowerCase().includes(tournamentSeriesName.toLowerCase())) {
        shouldQuery = true;
      } else if (tournament.primaryContact?.toLowerCase().includes(primaryContact.toLowerCase())) {
        shouldQuery = true;
      } else {
        shouldQuery = false;
      }
    } else if (tournamentSeriesName) {
      shouldQuery = tournament.name?.toLowerCase().includes(tournamentSeriesName.toLowerCase());
    } else if (primaryContact) {
      shouldQuery = tournament.primaryContact?.toLowerCase().includes(primaryContact.toLowerCase());
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

      if (singlesEvents.length > 0) {
        detailedTournaments.push({
          ...detailed,
          events: singlesEvents,
        });
      }
    } catch (error) {
      console.error(`Error fetching details for tournament ${tournament.id}:`, error);
    }
  }

  return { tournaments: { nodes: detailedTournaments } };
}
