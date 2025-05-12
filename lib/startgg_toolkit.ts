import fs from "fs";

export class RegionValue {
  countryCode: string;
  iso2: string;
  city: string;
  multiplier: number;
  note: string;

  constructor(countryCode: string, iso2: string, city: string, multiplier: number, note: string) {
    this.countryCode = countryCode;
    this.iso2 = iso2;
    this.city = city;
    this.multiplier = multiplier;
    this.note = note;
  }
}

export class Entrant {
  id: string;
  tag: string;

  constructor(id: string, tag: string) {
    this.id = id;
    this.tag = tag;
  }
}

export class TournamentTieringResult {
  slug: string;
  score: number;
  entrants: number;
  region?: RegionValue;
  values: any[];
  dqs: any[];
  potential?: any[];
  date: Date | null;
  isInvitational?: boolean;
  shouldCount?: boolean;

  constructor(
    slug: string,
    score: number,
    entrants: number,
    values: any[],
    dqs: any[],
    date: Date | null,
    shouldCount?: boolean
  ) {
    this.slug = slug;
    this.score = score;
    this.entrants = entrants;
    this.values = values;
    this.dqs = dqs;
    this.date = date;
    this.shouldCount = shouldCount;
  }
}

export class PlayerValue {
  id: string;
  tag: string;
  points: number;
  category: string;
  note: string;
  startTime?: Date;
  endTime?: Date;

  constructor(
    id: string,
    tag: string,
    points: number,
    category: string,
    note: string,
    startTime?: Date,
    endTime?: Date
  ) {
    this.id = id;
    this.tag = tag;
    this.points = points;
    this.category = category;
    this.note = note;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  isWithinTimeframe(time: Date): boolean {
    if (this.startTime && time < this.startTime) {
      return false;
    }
    if (this.endTime && time >= this.endTime) {
      return false;
    }
    return true;
  }
}

export class PlayerValueGroup {
  id: string;
  tag: string;
  values: PlayerValue[] = [];
  invitationalValues: PlayerValue[] = [];
  otherTags: string[] = [];

  constructor(id: string, tag: string, otherTags: string[] = []) {
    this.id = id;
    this.tag = tag;
    this.otherTags = otherTags.map(tag => tag.toLowerCase());
  }

  addValue(points: number, category: string, note: string, startTime?: Date, endTime?: Date): void {
    const value = new PlayerValue(this.id, this.tag, points, category, note, startTime, endTime);
    this.values.push(value);
    this.values.sort((a, b) => b.points - a.points);
  }

  addInvitationalValue(points: number, note: string, startTime?: Date, endTime?: Date): void {
    const value = new PlayerValue(this.id, this.tag, points, "Invitational Value", note, startTime, endTime);
    this.invitationalValues.push(value);
    this.invitationalValues.sort((a, b) => b.points - a.points);
  }

  retrieveValue(tournamentDate: Date, invitational: boolean = false): PlayerValue | null {
    const value = this.values.find((v) => v.isWithinTimeframe(tournamentDate));
    if (invitational) {
      const invitationalValue = this.invitationalValues.find((v) => v.isWithinTimeframe(tournamentDate));
      if (invitationalValue) {
        return new PlayerValue(
          this.id,
          this.tag,
          (value?.points || 0) + invitationalValue.points,
          value?.category || "",
          `${value?.note || ""} + Invitational Value`,
          value?.startTime,
          value?.endTime
        );
      }
    }
    return value || null;
  }

  matchTag(tag: string): boolean {
    return tag.toLowerCase() === this.tag.toLowerCase() || this.otherTags.includes(tag.toLowerCase());
  }
}

export async function sendRequest(query: string, variables: any): Promise<any> {
  const response = await fetch("https://api.start.gg/gql/alpha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json();
  return data;
}

export function isolateSlug(eventSlug: string): string {
  const parts = eventSlug.split("/");
  return parts[parts.length - 1];
}

export async function getEntrants(slug: string): Promise<Entrant[]> {
  const query = `
    query Entrants($eventSlug: String!) {
      event(slug: $eventSlug) {
        entrants(query: { perPage: 500, page: 1 }) {
          nodes {
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
  `;
  const variables = { eventSlug: slug };
  const data = await sendRequest(query, variables);
  const entrants: Entrant[] = [];
  data.data.event.entrants.nodes.forEach((node: any) => {
    const player = node.participants[0]?.player;
    if (player) {
      entrants.push(new Entrant(player.id.toString(), player.gamerTag));
    }
  });
  return entrants;
}

export async function getDqs(slug: string): Promise<{ dqList: Record<string, [Entrant, number]>; participants: Entrant[] }> {
  return { dqList: {}, participants: await getEntrants(slug) };
}

export async function getStartTime(slug: string): Promise<Date> {
  const query = `
    query GetStartTime($eventSlug: String!) {
      event(slug: $eventSlug) {
        startAt
      }
    }
  `;
  const variables = { eventSlug: slug };
  const data = await sendRequest(query, variables);
  return new Date(data.data.event.startAt * 1000);
}

export async function getPhases(slug: string): Promise<any[]> {
  const query = `
    query GetPhases($eventSlug: String!) {
      event(slug: $eventSlug) {
        phases {
          id
          name
        }
      }
    }
  `;
  const variables = { eventSlug: slug };
  const data = await sendRequest(query, variables);
  return data.data.event.phases;
}

export function readPlayersFromCsv(path: string, altTagsPath?: string): Map<string, PlayerValueGroup> {
  const fs = require("fs");
  const data = fs.readFileSync(path, "utf-8");
  const lines = data.trim().split("\n");
  const header = lines[0].split(",");
  const idIndex = header.indexOf("Start.gg Num ID");
  const tagIndex = header.indexOf("Player");
  const pointsIndex = header.indexOf("Points");
  const catIndex = header.indexOf("Category");
  const noteIndex = header.indexOf("Note");
  const startIndex = header.indexOf("Start Date");
  const endIndex = header.indexOf("End Date");

  const altTagMap: Record<string, string[]> = {};
  if (altTagsPath) {
    const altData = fs.readFileSync(altTagsPath, "utf-8");
    const altLines = altData.trim().split("\n");
    altLines.forEach(line => {
      const parts = line.split(",").map(p => p.trim()).filter(p => p);
      if (parts.length > 1) {
        const main = parts[0];
        altTagMap[main] = parts.slice(1);
      }
    });
  }

  const playerMap = new Map<string, PlayerValueGroup>();

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const id = row[idIndex] || row[tagIndex];
    const tag = row[tagIndex];
    const points = parseInt(row[pointsIndex], 10);
    const category = row[catIndex];
    const note = row[noteIndex];
    const startTime = row[startIndex] ? new Date(row[startIndex]) : undefined;
    const endTime = row[endIndex] ? new Date(row[endIndex]) : undefined;

    if (!playerMap.has(id)) {
      const otherTags = altTagMap[tag] || [];
      playerMap.set(id, new PlayerValueGroup(id, tag, otherTags));
    }

    playerMap.get(id)?.addValue(points, category, note, startTime, endTime);
  }

  return playerMap;
}
