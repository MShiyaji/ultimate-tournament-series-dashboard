// This file contains functions to interact with the start.gg API

const API_URL = "https://api.start.gg/gql/alpha"
type TournamentCacheKey = string;
type TournamentCacheEntry = {
  data: any;
  timestamp: number;
};

const tournamentCache = new Map<TournamentCacheKey, TournamentCacheEntry>();
const basicQueryCache = new Map<string, TournamentCacheEntry>();
const tournamentDetailCache = new Map<string, TournamentCacheEntry>();
const TOURNAMENT_CACHE_TTL = 1000 * 60 * 10; // 10 minutes

function makeCacheKey(startDate: string, endDate: string, primaryContact: string, seriesName: string): TournamentCacheKey {
  return JSON.stringify({ startDate, endDate, primaryContact, seriesName });
}

console.log('Environment variables:', {
  STARTGG_API_KEY: process.env.STARTGG_API_KEY,
  NODE_ENV: process.env.NODE_ENV
})

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function fetchFromAPI(query: string, variables: Record<string, any> = {}, retries = 2) {
  try {
    console.log(`Making API request with variables:`, JSON.stringify(variables))

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    if (data.errors) {
      throw new Error(data.errors.map((e: { message: string }) => e.message).join(", "))
    }

    return data.data
  } catch (error) {
    console.error("Error fetching from start.gg API:", error)
    throw error
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchberkeleyTournaments(startDate: string, endDate: string, primaryContact: string, tournamentSeriesName: string) {
  const cacheKey = makeCacheKey(startDate, endDate, primaryContact, tournamentSeriesName);
  const cached = tournamentCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < TOURNAMENT_CACHE_TTL) {
    console.log("✅ Returning cached tournament results");
    return { tournaments: { nodes: cached.data } };
  }

  const basicQuery = `
    query BasicTournamentInfo($startTimestamp: Timestamp!, $endTimestamp: Timestamp!, $page: Int!) {
      tournaments(query: {
        perPage: 100
        page: $page
        filter: {
          afterDate: $startTimestamp
          beforeDate: $endTimestamp
          videogameIds: [1386]
        }
      }) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          name
          primaryContact
          startAt
        }
      }
    }
  `

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
  `

  try {
    const allTournaments: any[] = []
    const chunkSizeDays = 21
    let currentStart = new Date(startDate)
    const finalEnd = new Date(endDate)

    while (currentStart < finalEnd) {
      const currentEnd = addDays(currentStart, chunkSizeDays)
      const chunkStartTimestamp = Math.floor(currentStart.getTime() / 1000)
      const chunkEndTimestamp = Math.floor(currentEnd.getTime() / 1000)
      const basicKey = `${chunkStartTimestamp}-${chunkEndTimestamp}`;

      if (basicQueryCache.has(basicKey) && Date.now() - basicQueryCache.get(basicKey)!.timestamp < TOURNAMENT_CACHE_TTL) {
        console.log(`✅ Using cached basic results for chunk ${basicKey}`);
        allTournaments.push(...basicQueryCache.get(basicKey)!.data);
        currentStart = currentEnd;
        continue;
      }

      let page = 1
      let totalPages = 1
      const chunkTournaments: any[] = []

      do {
        const result = await fetchFromAPI(basicQuery, {
          startTimestamp: chunkStartTimestamp,
          endTimestamp: chunkEndTimestamp,
          page,
        })

        const tournaments = result?.tournaments?.nodes || []
        totalPages = result?.tournaments?.pageInfo?.totalPages || 1

        chunkTournaments.push(...tournaments)
        page++

        await delay(500)
      } while (page <= totalPages)

      basicQueryCache.set(basicKey, {
        data: chunkTournaments,
        timestamp: Date.now(),
      });

      allTournaments.push(...chunkTournaments)
      currentStart = currentEnd
    }

    console.log(`Fetched ${allTournaments.length} tournaments in basic pass.`)

    const detailedTournaments = []

    for (const tournament of allTournaments) {
      // Check if the tournament matches the series name or primary contact
      const matchesSeries = tournamentSeriesName && tournament.name?.toLowerCase().includes(tournamentSeriesName.toLowerCase());
      const matchesContact = primaryContact && tournament.primaryContact?.toLowerCase().includes(primaryContact.toLowerCase());

      // If both filters are present, prioritize series name match
      if (tournamentSeriesName && primaryContact) {
        if (!matchesSeries && !matchesContact) {
          continue; // Skip if neither condition passes
        }
      } else if (tournamentSeriesName && !matchesSeries) {
        continue; // Skip if series name is present but does not match
      } else if (primaryContact && !matchesContact) {
        continue; // Skip if primary contact is present but does not match
      }

      const detailCached = tournamentDetailCache.get(tournament.id);
      if (detailCached && Date.now() - detailCached.timestamp < TOURNAMENT_CACHE_TTL) {
        console.log(`✅ Using cached detail for tournament ${tournament.id}`);
        detailedTournaments.push(detailCached.data);
        continue;
      }

      try {
        await delay(800);
        const detailedData = await fetchFromAPI(detailQuery, { tournamentId: tournament.id });
        const detailed = detailedData?.tournament;

        if (!detailed) continue;

        const singlesEvents = detailed.events.filter((event: { name: string }) =>
          event.name.toLowerCase().includes("singles")
        );

        if (singlesEvents.length > 0) {
          const enriched = {
            ...detailed,
            events: singlesEvents,
          };
          tournamentDetailCache.set(tournament.id, {
            data: enriched,
            timestamp: Date.now(),
          });
          detailedTournaments.push(enriched);
        }
      } catch (error) {
        console.error(`Error fetching details for tournament ${tournament.id}:`, error);
      }
    }

    tournamentCache.set(cacheKey, {
      data: detailedTournaments,
      timestamp: Date.now(),
    });

    return { tournaments: { nodes: detailedTournaments } }
  } catch (error) {
    console.error("Error fetching tournaments:", error)
    throw error
  }
}
