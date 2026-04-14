import { Suspense } from "react"
import { TournamentDashboard } from "@/components/tournament-dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"

export default function Home() {
  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.9)), url("/download.jpg")',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'repeat',
        color: 'white'
      }}
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <TournamentDashboard />
      </Suspense>
    </div>
  )
}
