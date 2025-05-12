import { Suspense } from "react"
import { TournamentDashboard } from "@/components/tournament-dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DashboardSkeleton />}>
        <TournamentDashboard />
      </Suspense>
    </div>
  )
}
