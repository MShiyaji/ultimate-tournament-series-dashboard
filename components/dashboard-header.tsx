import { Trophy } from "lucide-react"

export function DashboardHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-4 pb-6 border-b">
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">Track player performance across a tournament series</p>
        </div>
      </div>
    </div>
  )
}
