import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function extractSeriesName(tournamentTitle: string): string {
  // Try to match the first capitalized word(s) before a keyword like "Weekly", "Monthly", etc.
  const match = tournamentTitle.match(/([A-Z][a-zA-Z]+)(?:\s+(Weekly|Monthly|Series|Saga|Bracket|Cup))?/);
  // If no match is found, return "Series" as a default
  // Otherwise, return the matched series name;
  return match ? match[1] : (tournamentTitle.match(/^(\w+)/)?.[0] || "Series");
}