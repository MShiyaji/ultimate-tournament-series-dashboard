import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

export function RisingStarsTable({ players }) {
  if (!players || players.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-xl font-bold">Rising Stars</CardTitle>
          <CardDescription>
            Players with the largest normalized placement improvement
          </CardDescription>
        </div>
        <TrendingUp className="h-5 w-5 text-green-600" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Improvement</TableHead>
              <TableHead className="text-right">Early Avg</TableHead>
              <TableHead className="text-right">Late Avg</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player, index) => (
              <TableRow key={player.id || player.name}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{player.name}</TableCell>
                <TableCell className="text-right text-green-700 font-bold">
                  +{Number(player.improvementScore).toFixed(3)}
                </TableCell>
                <TableCell className="text-right">
                  {Number(player.earlyAvg).toFixed(3)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">
                    {Number(player.lateAvg).toFixed(3)}
                  </Badge>
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
