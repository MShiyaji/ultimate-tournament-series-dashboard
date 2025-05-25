import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, TrendingUp, Target } from "lucide-react"

interface FullListViewProps {
  data: {
    type: "topPerformers" | "risingStars" | "seedOutperformers" | "consistentPlayers";
    title: string;
    players: any[];
  } | null;
  onGoBack: () => void;
  filterName?: string;
}

export function FullListView({ data, onGoBack, filterName }: FullListViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const playersPerPage = 20;

  if (!data) return null;

  // Filter players if filterName is provided
  const filteredPlayers = filterName?.trim()
    ? data.players.filter((p) =>
        p.name?.toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : data.players;

  // Pagination
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const startIndex = (currentPage - 1) * playersPerPage;
  const currentPlayers = filteredPlayers.slice(startIndex, startIndex + playersPerPage);

  // Get icon based on type
  const getIcon = () => {
    switch (data.type) {
      case "topPerformers": return <Trophy className="h-5 w-5 text-primary" />;
      case "risingStars": return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "seedOutperformers": return <TrendingUp className="h-5 w-5 text-primary" />;
      case "consistentPlayers": return <Target className="h-5 w-5 text-primary" />;
      default: return null;
    }
  };

  // Render table based on type
  const renderTable = () => {
    switch (data.type) {
      case "topPerformers":
        return (
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Performance Score</TableHead>
                <TableHead className="text-right">Best Placement</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPlayers.map((player, index) => {
                const rank = startIndex + index + 1;
                let medalColor = "";
                if (rank === 1) medalColor = "#FFD700";
                else if (rank === 2) medalColor = "#C0C0C0";
                else if (rank === 3) medalColor = "#CD7F32";

                return (
                  <TableRow key={player.id || index}>
                    <TableCell className="font-medium">
                      <span style={rank <= 3 ? { color: medalColor, fontWeight: 700 } : {}}>
                        {rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-right">{player.performanceScore || player.averageNormalizedPlacement}</TableCell>
                    <TableCell className="text-right">{player.bestPlacement}</TableCell>
                    <TableCell className="text-right">{player.tournaments}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );

      case "risingStars":
        return (
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Improvement</TableHead>
                <TableHead className="text-right">Early Avg</TableHead>
                <TableHead className="text-right">Late Avg</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPlayers.map((player, index) => {
                const rank = startIndex + index + 1;
                const improvement = Number(player.improvementScore);
                const improvementColor =
                  improvement > 0
                    ? "text-green-700 font-bold"
                    : improvement < 0
                    ? "text-red-700 font-bold"
                    : "";

                return (
                  <TableRow key={player.id || index}>
                    <TableCell className="font-medium">{rank}</TableCell>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className={`text-right ${improvementColor}`}>
                      {improvement.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right">{Number(player.earlyAvg).toFixed(3)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{Number(player.lateAvg).toFixed(3)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{player.tournaments}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );

      case "seedOutperformers":
        return (
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Avg. Upset Factor</TableHead>
                <TableHead className="text-right">Best Upset Factor</TableHead>
                <TableHead className="text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPlayers.map((player, index) => {
                const rank = startIndex + index + 1;
                const avg = Number(player.avgUpsetFactor);
                const avgColor =
                  avg > 0
                    ? "text-green-700 font-bold"
                    : avg < 0
                    ? "text-red-700 font-bold"
                    : "";
                const best = Number(player.bestOutperform);
                const bestColor =
                  best > 0
                    ? "text-green-700 font-bold"
                    : best < 0
                    ? "text-red-700 font-bold"
                    : "";

                return (
                  <TableRow key={player.id || index}>
                    <TableCell className="font-medium">{rank}</TableCell>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className={`text-right ${avgColor}`}>
                      {isNaN(avg) ? "-" : avg.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right ${bestColor}`}>
                      {isNaN(best) ? "-" : best.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{player.tournaments}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );

      case "consistentPlayers":
        return (
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Consistency</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPlayers.map((player, index) => {
                const rank = startIndex + index + 1;
                const consistencyValue = typeof player.consistency === "string"
                  ? parseFloat(player.consistency.replace("%", ""))
                  : player.consistency;

                return (
                  <TableRow key={player.id || index}>
                    <TableCell className="font-medium">{rank}</TableCell>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-right">
                      {consistencyValue > 90 ? (
                        <span className="font-semibold" style={{ color: "#FFD700" }}>
                          {player.consistency}
                        </span>
                      ) : (
                        <span className="font-medium">{player.consistency}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{player.tournaments}</TableCell>
                    <TableCell className="text-right">
                      {player.seedVariance ?? player.upsetFactorVariance}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={onGoBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          {filterName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Filtered by: {filterName}
            </p>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
        {filterName && ` matching "${filterName}"`}
      </div>

      {/* Full Table */}
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {getIcon()}
              {data.title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {renderTable()}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}