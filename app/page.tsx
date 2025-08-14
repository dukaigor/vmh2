"use client"

import { useState, useEffect } from "react"
import type { Worker, WorkSession } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, Users, Settings } from "lucide-react"
import { AdminPanel } from "@/components/admin-panel"

export default function HomePage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [activeSessions, setActiveSessions] = useState<WorkSession[]>([])
  const [currentView, setCurrentView] = useState<"checkin" | "admin">("checkin")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    loadData()
    runAutoClose()

    // Set up periodic auto-close check every 5 minutes
    const interval = setInterval(runAutoClose, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [workersData, sessionsData] = await Promise.all([
        FirebaseService.getWorkers(),
        FirebaseService.getActiveSessions(),
      ])
      setWorkers(workersData)
      setActiveSessions(sessionsData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const runAutoClose = async () => {
    try {
      await FirebaseService.autoCloseSessions()
    } catch (error) {
      console.error("Error running auto-close:", error)
    }
  }

  const handleCheckIn = async (worker: Worker) => {
    try {
      const result = await FirebaseService.checkInWorker(worker)
      if (result.success) {
        setMessage({ type: "success", text: result.message })
        await loadData()
      } else {
        setMessage({ type: "error", text: result.message })
      }
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error("Error checking in:", error)
      setMessage({ type: "error", text: "Errore durante il check-in" })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleCheckOut = async (workerId: string) => {
    try {
      await FirebaseService.checkOutWorker(workerId)
      setMessage({ type: "success", text: "Check-out effettuato con successo" })
      await loadData()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error("Error checking out:", error)
      setMessage({ type: "error", text: "Errore durante il check-out" })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const isWorkerActive = (workerId: string) => {
    return activeSessions.some((session) => session.workerId === workerId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">VMH Tracker</h1>
                <p className="text-sm text-gray-500">Sistema di Gestione Presenze</p>
              </div>
            </div>

            <nav className="flex space-x-2">
              <Button
                variant={currentView === "checkin" ? "default" : "ghost"}
                onClick={() => setCurrentView("checkin")}
                className="flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Presenze</span>
              </Button>
              <Button
                variant={currentView === "admin" ? "default" : "ghost"}
                onClick={() => setCurrentView("admin")}
                className="flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>Admin</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <Alert
            className={`mb-6 ${message.type === "success" ? "border-green-200 bg-green-50" : ""}`}
            variant={message.type === "error" ? "destructive" : "default"}
          >
            <AlertDescription className={message.type === "success" ? "text-green-800" : ""}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {currentView === "checkin" && (
          <div className="space-y-8">
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <Card className="bg-white/60 backdrop-blur-sm border-green-200/50">
                <CardHeader>
                  <CardTitle className="text-green-700 flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Lavoratori Attivi</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeSessions.map((session) => (
                      <div key={session.workerId} className="bg-white/80 rounded-xl p-4 border border-green-200/50">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="font-medium text-gray-900">{session.workerName}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">Entrata: {session.checkIn}</p>
                        <Button
                          onClick={() => handleCheckOut(session.workerId)}
                          className="w-full bg-red-500 hover:bg-red-600 text-white"
                        >
                          Uscita
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Worker Selection */}
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
              <CardHeader>
                <CardTitle className="text-gray-900">Seleziona Lavoratore</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                  {workers.map((worker) => {
                    const isActive = isWorkerActive(worker.id)
                    return (
                      <button
                        key={worker.id}
                        onClick={() => !isActive && handleCheckIn(worker)}
                        disabled={isActive}
                        className={`group relative p-6 rounded-2xl transition-all duration-200 ${
                          isActive
                            ? "bg-green-50 border-2 border-green-200 cursor-not-allowed"
                            : "bg-white/80 hover:bg-white hover:shadow-lg border-2 border-gray-200/50 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex flex-col items-center space-y-4">
                          <div className={`relative ${isActive ? "opacity-60" : ""}`}>
                            <Avatar className="h-20 w-20 ring-4 ring-white shadow-lg">
                              <AvatarImage src={worker.imageUrl || "/placeholder.svg"} alt={worker.name} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-lg">
                                {worker.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            {isActive && (
                              <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-gray-900 text-sm">{worker.name}</p>
                            {worker.hourlyRate && worker.hourlyRate > 0 && (
                              <p className="text-xs text-gray-500">€{worker.hourlyRate.toFixed(2)}/ora</p>
                            )}
                            {isActive && <p className="text-xs text-green-600 font-medium">Attivo</p>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === "admin" && <AdminPanel onDataChange={loadData} />}
      </main>
    </div>
  )
}
