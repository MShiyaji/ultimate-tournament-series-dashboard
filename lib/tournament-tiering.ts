import { getEntrants, getDqs, getPhases, getStartTime, retrievePlayerValue } from './startgg_toolkit'

interface Entrant {
  id: string
  tag: string
}

interface PlayerValue 
  id: string
  tag: string
  points: number
  category: string
  note: string
  startTime?: Date
  endTime?: Date
}

interface TournamentTieringResult {
  slug: string
  score: number
  entrants: number
  values: PlayerValue[]
  dqs: PlayerValue[]
  date: Date
  shouldCount: boolean
}

const NUM_PLAYERS_FLOOR = 2
const SCORE_FLOOR = 250
const ENTRANT_FLOOR = 64

export async function calculateTournamentTier(slug: string, isInvitational: boolean = false): Promise<TournamentTieringResult> {
  const startTime = await getStartTime(slug)
  const entrants = await getEntrants(slug)
  const dqInfo = await getDqs(slug)
  const dqList = dqInfo.dqList
  const participants = dqInfo.participants

  let totalEntrants = participants.length + dqList.length
  let totalScore = totalEntrants // No multiplier logic included

  const valuedParticipants: PlayerValue[] = []
  const dqPlayers: PlayerValue[] = []

  for (const entrant of participants) {
    const value = await getPlayerValue(entrant.id, slug, isInvitational)
    if (value) {
      valuedParticipants.push(value)
      totalScore += value.points
    }
  }

  for (const [id, dqData] of Object.entries(dqList)) {
    const value = await getPlayerValue(id, slug, isInvitational)
    if (value) {
      dqPlayers.push(value)
      totalScore += value.points
    }
  }

  const shouldCount =
    totalEntrants >= ENTRANT_FLOOR ||
    (totalScore >= SCORE_FLOOR && valuedParticipants.length >= NUM_PLAYERS_FLOOR)

  return {
    slug,
    score: totalScore,
    entrants: totalEntrants,
    values: valuedParticipants,
    dqs: dqPlayers,
    date: startTime,
    shouldCount
  }
}
