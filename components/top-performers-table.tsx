import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from "react"

export function TopPerformersTable({ players }) {
  // Mock data for demonstration
  const mockPlayers = [
    { id: 1, name: "MkLeo", placements: [1, 1, 2, 1, 3], avgPlacement: 1.6, bestPlacement: 1, tournaments: 5 },
    { id: 2, name: "Tweek", placements: [2, 3, 1, 2, 5], avgPlacement: 2.6, bestPlacement: 1, tournaments: 5 },
    { id: 3, name: "Sparg0", placements: [3, 2, 5, 3, 2], avgPlacement: 3.0, bestPlacement: 2, tournaments: 5 },
    { id: 4, name: "Light", placements: [5, 4, 3, 5, 4], avgPlacement: 4.2, bestPlacement: 3, tournaments: 5 },
    { id: 5, name: "Glutonny", placements: [4, 5, 4, 7, 7], avgPlacement: 5.4, bestPlacement: 4, tournaments: 5 },
  ]

  const displayPlayers = players || mockPlayers

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Top Performers</CardTitle>
          <CardDescription>Players with the highest weighted placements</CardDescription>
        </div>
        <Trophy className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Performance Score</TableHead>
              <TableHead className="text-right">Best Placement</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayPlayers.map((player: { id: Key | null | undefined; name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; performanceScore: any; averageNormalizedPlacement: any; bestPlacement: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; tournaments: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined }, index: number) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{player.name}</div>
                </TableCell>
                <TableCell className="text-right">{player.performanceScore || player.averageNormalizedPlacement}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={index < 3 ? "default" : "outline"}>{player.bestPlacement}</Badge>
                </TableCell>
                <TableCell className="text-right">{player.tournaments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
