/**
 * Process tournament data to extract player statistics
 * @param data Raw tournament data from the API
 * @returns Processed statistics for display
 */
import path from "path";
import fs from "fs/promises";
import { extractSeriesName } from "./utils";
// Function to load player points from a CSV file
// This function reads a CSV file and returns a map of player IDs to their points
async function loadPlayerPoints(): Promise<Map<string, number>> {
  const playerPoints = new Map<string, number>();

  try {
    // Resolve the absolute path to the CSV file
    const filePath = path.resolve(process.cwd(), "public", "ultrank_players.csv");

    // Read the file contents
    const data = await fs.readFile(filePath, "utf-8");

    // Parse the CSV data
    const lines = data.split("\n").slice(1); // Skip the header row

    lines.forEach((line) => {
      const [_, __, player, ___, playerId, points] = line.split(",");
      if (playerId && points) {
        playerPoints.set(playerId.trim(), parseInt(points.trim(), 10));
      }
    });
  } catch (error) {
    console.error("Error loading player points:", error);
  }

  return playerPoints;
}
export function processberkeleyData(data: { tournaments: any }, playerName?: string, attendanceRatio?: number) {
  try {
    console.log("Processing tournament data")

    // Check if we have valid data
    if (!data || !data.tournaments || !data.tournaments.nodes) {
      console.log("Invalid tournament data format")
      throw new Error("Invalid tournament data format")
    }
    const tournaments = data.tournaments.nodes.filter((t) => t && t.events && t.events.length > 0)
    console.log(`Found ${tournaments.length} tournaments with events`)
    
    if (tournaments.length === 0) {
      console.log("No tournaments with events found in the data")
      throw new Error("No tournaments with events found in the data")
    }

    // Sort tournaments by their start date
    tournaments.sort((a: { startAt: number }, b: { startAt: number }) => {
      const aNum = a.startAt ? new Date(a.startAt * 1000).getTime() : null
      const bNum = b.startAt ? new Date(b.startAt * 1000).getTime() : null
      if (aNum && bNum) return aNum - bNum
      return (a.startAt || 0) - (b.startAt || 0)
    })

    // Collect all player results across tournaments
    const playerResults = new Map()
    let totalEntrants = 0
    let upsetCount = 0
    let matchCount = 0

    // Process each tournament
    tournaments.forEach((tournament: { name: string; events: any[] }) => {
      if (!tournament) return

      console.log(`Processing tournament: ${tournament.name}`)

      // Find the main berkeley event in each tournament
      const berkeleyEvents = tournament.events.filter(
        (event) => event && event.name && event.name.toLowerCase().includes("berkeley"),
      )

      // If no specific berkeley events, use all events
      const eventsToProcess = berkeleyEvents.length > 0 ? berkeleyEvents : tournament.events
      console.log(`Processing ${eventsToProcess.length} events for tournament: ${tournament.name}`)

      eventsToProcess.forEach((event) => {
        if (!event || !event.standings || !event.standings.nodes) {
          console.log(`No standings found for event: ${event?.name}`)
          return
        }

        totalEntrants += event.numEntrants || 0
        console.log(`Event ${event.name} has ${event.standings.nodes.length} standings entries`)

        // Process standings for this event
        event.standings.nodes.forEach((standing: { entrant: { participants: { player: { gamerTag: any } }[]; id: any; initialSeedNum: number }; placement: any }) => {
          if (!standing || !standing.entrant) {
            console.log("Invalid standing entry found")
            return
          }

          const playerId = standing.entrant.participants?.[0]?.player?.id || standing.entrant.id
          const playerName = standing.entrant.participants?.[0]?.player?.gamerTag 
          const placement = standing.placement
          const seed = standing.entrant.initialSeedNum || 0
          const numEntrants = event.numEntrants || 1
          const date = event.startAt
          // Calculate if this was an upset (player placed better than their seed)
          if (seed > 0 && placement < seed) {
            upsetCount++
          }
          if (seed > 0) {
            matchCount++
          }

          // Store player result
          if (!playerResults.has(playerId)) {
            playerResults.set(playerId, {
              id: playerId,
              name: playerName,
              placements: [],
              seeds: [],
              tournaments: 0,
              tournamentNumbers: [],
              entrants: [],
              date: []
            })
          }

          const playerData = playerResults.get(playerId)
          playerData.placements.push(placement)
          playerData.seeds.push(seed)
          playerData.tournaments++

          playerData.entrants.push(numEntrants)
          playerData.date.push(date)
          if (!playerData.results) {
            playerData.results = []
          }
          playerData.results.push({
            placement,
            entrants: numEntrants,
            date,
          })
        })
      })
    })

    console.log(`Processed data for ${playerResults.size} players`)

    // Calculate statistics for each player
    const players = Array.from(playerResults.values()).map((player) => {
      // Calculate average placement
      const avgPlacement = player.placements.reduce((sum: any, p: any) => sum + p, 0) / player.placements.length

      // Calculate best placement
      const bestPlacement = Math.min(...player.placements)

      //calculate seed outplacement
      function mapSeedToBucket(seed: number): number {
        if (seed === 1) return 0
        if (seed === 2) return 1
        if (seed === 3) return 2
        if (seed === 4) return 3
        if (seed <= 6) return 4
        if (seed <= 8) return 5
        if (seed <= 12) return 6
        if (seed <= 16) return 7
        if (seed <= 24) return 8
        if (seed <= 32) return 9
        if (seed <= 48) return 10
        if (seed <= 64) return 11
        if (seed <= 96) return 12
        if (seed <= 128) return 13
        if (seed <= 192) return 14
        if (seed <= 256) return 15
        if (seed <= 384) return 16
        if (seed <= 512) return 17
        if (seed <= 768) return 18
        return 19
      }
      
      function mapPlacementToBucket(placement: number): number {
        if (placement === 1) return 0
        if (placement === 2) return 1
        if (placement === 3) return 2
        if (placement === 4) return 3
        if (placement === 5) return 4
        if (placement === 7) return 5
        if (placement === 9) return 6
        if (placement === 13) return 7
        if (placement === 17) return 8
        if (placement === 25) return 9
        if (placement === 33) return 10
        if (placement === 49) return 11
        if (placement === 65) return 12
        if (placement === 97) return 13
        if (placement === 129) return 14
        if (placement === 193) return 15
        if (placement === 257) return 16
        if (placement === 385) return 17
        if (placement === 513) return 18
        if (placement === 769) return 19
        return 19
      }
      
      const upsetMatrix = [
        [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18, -19],
        [1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18],
        [2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17],
        [3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16],
        [4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15],
        [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14],
        [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13],
        [7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12],
        [8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10],
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9],
        [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8],
        [11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7],
        [12, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6],
        [13, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5],
        [14, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4],
        [15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3],
        [16, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2],
        [17, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1],
        [18, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
      ]
      
      function calculateUpsetFactor(seed: number, placement: number): number {
        const seedBucket = mapSeedToBucket(seed)
        const placementBucket = mapPlacementToBucket(placement)
        return upsetMatrix[seedBucket][placementBucket]
      }
      const upsetFactors = player.placements.map((placement: number, i: string | number) => {
        const seed = player.seeds[i]
        return calculateUpsetFactor(seed, placement)
      })
      
      const totalUpsetFactor = upsetFactors.reduce((sum: any, x: any) => sum + x, 0)
      const avgUpsetFactor = totalUpsetFactor / (upsetFactors.length || 1)
      const bestOutperform = upsetFactors.length > 0 ? Math.max(...upsetFactors) : 0
      
      // calculate their overall performance score 
      const normalizedPlacements = player.placements.map((placement: number, i: string | number) => {
        const entrants = player.entrants?.[i] || 1
        return (entrants - placement + 1) / entrants
      })
      
      const averageNormalizedPlacement = normalizedPlacements.length > 0
        ? normalizedPlacements.reduce((sum: any, score: any) => sum + score, 0) / normalizedPlacements.length
        : 0
      // Load player points from ultrank_players.csv
      const playerPoints = loadPlayerPoints();

      const weightedPlacements = player.placements.map((placement: number, i: number) => {
        const entrants = player.entrants?.[i] || 1;
        const tournamentPlayers = tournaments[i]?.players || []; // Assume tournaments[i].players contains player IDs
        const tournamentPoints = tournamentPlayers.reduce((sum: number, playerId: string) => {
          return sum + (playerPoints.get(playerId) || 0);
        }, 0);

        // Calculate weighted placement
        const weight = tournamentPoints > 0 ? tournamentPoints : entrants; // Use entrants as fallback if no points
        return ((entrants - placement + 1) / entrants) * weight;
      });

      const averageWeightedPlacement = weightedPlacements.length > 0
        ? weightedPlacements.reduce((sum: number, score: number) => sum + score, 0) / weightedPlacements.length
        : 0;
            const baseBoost = 5
            function determineLogBase(totalTournaments: number): number {
              if (totalTournaments <= 3) return 2
              if (totalTournaments <= 7) return 2.5
              if (totalTournaments <= 12) return 3
              if (totalTournaments <= 20) return 3.5
              return 5 // very large seasons
            }
      const logBase = determineLogBase(tournaments.length) // tournaments comes from the season
      const tournamentsAttended = player.tournaments
      const adjustedLog = Math.log(tournamentsAttended+1) / Math.log(logBase)
      const performanceScore = 
        tournamentsAttended > 0 && avgUpsetFactor !== undefined
          ? adjustedLog * averageWeightedPlacement
          : 0;
      // Calculate consistency % of tournaments where placement <= seed
      const weightedConsistency = player.placements?.reduce((sum: number, placement: number, i: number) => {
        const seed = player.seeds?.[i];
        const entrants = player.entrants?.[i] || 1;
        if (seed !== undefined && placement <= seed) {
          return sum + entrants; // Add entrants for consistent tournaments
        }
        return sum;
      }, 0) || 0;
      
      const totalEntrants = player.entrants?.reduce((sum: number, entrants: number) => sum + entrants, 0) || 1;
      
      const consistency = (weightedConsistency / totalEntrants) * 100;

      // calculate improvement score 
      const sortedResults = player.results.sort((a, b) => a.date - b.date)
      const half = Math.floor(sortedResults.length / 2)
      const earlyResults = sortedResults.slice(0, half)
      const lateResults = sortedResults.slice(half)
      function getNormalizedAvg(results: any[]) {
        return results.length === 0
          ? 0
          : results.reduce((sum, r) => sum + ((r.entrants - r.placement + 1) / r.entrants), 0) / results.length
      }
      
      const earlyAvg = getNormalizedAvg(earlyResults)
      const lateAvg = getNormalizedAvg(lateResults)
      const improvementScore = lateAvg - earlyAvg

      // Calculate upset factor variance
      const meanUpsetFactor = upsetFactors.reduce((sum, x) => sum + x, 0) / (upsetFactors.length || 1);
      const upsetFactorVariance = upsetFactors.reduce((sum, x) => sum + Math.pow(x - meanUpsetFactor, 2), 0) / (upsetFactors.length || 1);

      return {
        ...player,
        avgPlacement,
        bestPlacement,
        avgUpsetFactor,
        bestOutperform,
        consistency: Math.round(consistency),
        performanceScore,
        earlyAvg,
        lateAvg,
        adjustedLog,
        improvementScore,
        averageNormalizedPlacement,
        upsetFactorVariance,
      }
    })

    // Filter out players with insufficient data
    const validPlayers = players.filter((p) => p.tournaments >= 1)
    console.log(`Found ${validPlayers.length} players with at least 1 tournament`)

    // Sort players by different metrics
    const topPerformers = [...validPlayers]
    .filter(p => p.tournaments >= Math.max(attendanceRatio*tournaments.length, 2)) // Filter based on if they have attended more than 1/4 of total tournaments or 2, whichever is lower
    .sort((a, b) => {
      if (tournaments.length > 5) {
        // Primary: performanceScore, Secondary: tournaments
        return b.performanceScore - a.performanceScore || b.tournaments - a.tournaments
      } else {
        // Primary: averageNormalizedPlacement, Secondary: tournaments
        return b.averageNormalizedPlacement - a.averageNormalizedPlacement || b.tournaments - a.tournaments
      }
    })
    .map((p) => ({
      ...p,
      avgPlacement: p.avgPlacement,
      bestPlacement: p.bestPlacement,
      tournaments: p.tournaments,
      performanceScore: tournaments.length > 5 && p.performanceScore !== undefined
        ? p.performanceScore.toFixed(2) // Only include performanceScore if applicable
        : undefined,
      averageNormalizedPlacement: tournaments.length <= 5 && p.averageNormalizedPlacement !== undefined
        ? p.averageNormalizedPlacement.toFixed(2) // Only include averageNormalizedPlacement if applicable
        : undefined
    }));
    

    const seedOutperformers = [...validPlayers]
    .filter((p) => p.tournaments >= Math.max(attendanceRatio*tournaments.length, 2))
    .sort((a, b) => {
      if (tournaments.length > 5) {
        // Primary: avgUpsetFactor * adjustedLog, Secondary: tournaments
        return (b.avgUpsetFactor * b.adjustedLog) - (a.avgUpsetFactor * a.adjustedLog) || b.tournaments - a.tournaments
      } else {
        // Primary: avgUpsetFactor, Secondary: tournaments
        return b.avgUpsetFactor - a.avgUpsetFactor || b.tournaments - a.tournaments
      }
    })
    .map((p) => ({
      ...p,
      avgUpsetFactor: `${p.avgUpsetFactor.toFixed(1)}`,
      bestOutperform: `${p.bestOutperform}`,
      tournaments: p.tournaments,
      adjustedLog: tournaments.lengthmu > 5 && p.adjustedLog !== undefined
        ? p.adjustedLog.toFixed(2)
        : undefined, // Include adjustedLog only if applicable
    }))

    const consistentPlayers = [...validPlayers]
    .filter((p) => p.tournaments >= Math.max(attendanceRatio*tournaments.length, 2))
    .sort((a, b) => {
      // Primary: consistency * adjustedLog, Secondary: tournaments
      const aWeighted = (a.consistency ?? 0) * (a.adjustedLog ?? 0);
      const bWeighted = (b.consistency ?? 0) * (b.adjustedLog ?? 0);
      return bWeighted - aWeighted || b.tournaments - a.tournaments;
    })
    .map((p) => ({
      ...p,
      consistency: `${p.consistency}%`,
      tournaments: p.tournaments,
      upsetFactorVariance: p.upsetFactorVariance.toFixed(2),
    }))
    const risingStars = [...validPlayers]
      .filter(
        (p) =>
          p.tournaments >= Math.max(attendanceRatio * tournaments.length, 2) && !topPerformers.slice(0, 5).map(p => p.id).includes(p.id) )
      .sort((a, b) => b.improvementScore - a.improvementScore || b.tournaments - a.tournaments)
      .map((p) => ({
        ...p,
        tournaments: p.tournaments,
        performanceScore:
          tournaments.length > 5 && p.performanceScore !== undefined
            ? p.performanceScore
            : undefined, 
        averageNormalizedPlacement:
          tournaments.length <= 5 && p.averageNormalizedPlacement !== undefined
            ? p.averageNormalizedPlacement
            : undefined, 
      }));
    // Generate performance chart data for top 5 players
    const performanceData: { tournament: any }[] = []
    const topPlayerIds = topPerformers.map((p) => p.id)
    const firstName = data.tournaments.nodes[0].name
    console.log("First tournament name:", firstName)
    console.log("Extracted series name:", extractSeriesName(firstName));
          

    // For each tournament, create a data point with placements for top players
    tournaments.forEach((tournament: { events: any[]; name: string }) => {
      if (!tournament) return;
    
      // Initialize dataPoint for this tournament
      const dataPoint: { tournament: any; [key: string]: any } = { tournament: tournament.name };
    
      // Find the main Berkeley event in this tournament
      const berkeleyEvents = tournament.events.filter(
        (event) => event && event.name && event.name.toLowerCase().includes("singles")
      );
      // If no specific Berkeley events, use all events
      const eventsToProcess = berkeleyEvents.length > 0 ? berkeleyEvents : tournament.events;
    
      // Get tournament number for the label
      // For each top player, find their placement in this tournament
      topPlayerIds.forEach((playerId) => {
        const player = validPlayers.find((p) => p.id === playerId);
        if (!player) return;
    
        // Find this player's result in this tournament
        let found = false;
        eventsToProcess.forEach((event) => {
          if (!event || !event.standings || !event.standings.nodes || found) return;

          const standing = event.standings.nodes.find(
            (s: { entrant: { participants: { player: { id: any } }[]; id: any } }) =>
              s && s.entrant && (s.entrant.participants?.[0]?.player?.id === playerId || s.entrant.id === playerId)
          );

          if (standing) {
            dataPoint[player.name] = standing.placement;
            found = true; // Optionally set found to true if you want to stop after the first match
          }
        });
      });
    
      // Only add data points that have at least one player's placement
      if (Object.keys(dataPoint).length > 1) {
        if (dataPoint.tournament) {
          performanceData.push(dataPoint);
        }
      }
    });

    // Calculate the number of tournaments attended by the selected player
    let playerTournaments = 0;
    if (playerName && playerName.trim()) {
      const lowerPlayerName = playerName.trim().toLowerCase();
      playerTournaments = tournaments.filter(tournament =>
        tournament.events.some(event =>
          event.standings?.nodes?.some(
            (standing: any) =>
              standing.entrant?.participants?.some(
                (participant: any) =>
                  participant.player?.gamerTag?.toLowerCase() === lowerPlayerName
              )
          )
        )
      ).length;
    }

    // Calculate summary statistics
    const summary = {
      totalPlayers: validPlayers.length,
      totalTournaments: tournaments.length,
      averageEntrants: tournaments.length > 0 ? Math.round(totalEntrants / tournaments.length) : 0,
      upsetRate: matchCount > 0 ? `${Math.round((upsetCount / matchCount) * 100)}%` : "0%",
      ...(playerName && playerName.trim() && { playerTournaments }),
    }
    // get a list of all tournament names and slugs
    const tournamentNames = tournaments.map((tournament: { name: string }) => tournament.name);
    const tournamentSlugs = tournaments.map((tournament: { slug: string }) => tournament.slug);

    let filteredTournamentNames = tournamentNames;
    let filteredTournamentSlugs = tournamentSlugs;
    if (playerName && playerName.trim()) {
      const lowerPlayerName = playerName.trim().toLowerCase();
      const filteredTournaments = tournaments
        .filter(tournament =>
          tournament.events.some(event =>
            event.standings?.nodes?.some(
              (standing: any) =>
                standing.entrant?.participants?.some(
                  (participant: any) =>
                    participant.player?.gamerTag?.toLowerCase() === lowerPlayerName
                )
            )
          )
        );
      filteredTournamentNames = filteredTournaments.map((t: { name: string }) => t.name);
      filteredTournamentSlugs = filteredTournaments.map((t: { slug: string }) => t.slug);
    }

    const allPlayerNames = Array.from(playerResults.values())
      .map(player => player.name)
      .filter(Boolean);

    console.log("Data processing complete")

    return {
      summary,
      topPerformers,
      seedOutperformers,
      consistentPlayers,
      performanceData,
      risingStars,
      tournamentNames: filteredTournamentNames,
      tournamentSlugs: filteredTournamentSlugs,
      allPlayerNames, 
    }
  } catch (error) {
    console.error("Error processing tournament data:", error)
    // Return empty data instead of throwing
    return {
      summary: {
        totalPlayers: 0,
        totalTournaments: 1,
        averageEntrants: 0,
        upsetRate: "0%",
      },
      topPerformers: [],
      seedOutperformers: [],
      consistentPlayers: [],
      performanceData: [],
      risingStars: [],
      tournamentNames: [],
      tournamentSlugs: [],
      allPlayerNames: [], 
    }
  }
}
