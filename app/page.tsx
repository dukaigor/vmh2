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
import { AnimatedClockWeather } from "@/components/animated-clock-weather"
import { PWAInstallButton } from "@/components/pwa-install-button"

export default function HomePage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [activeSessions, setActiveSessions] = useState<WorkSession[]>([])
  const [currentView, setCurrentView] = useState<"checkin" | "admin">("checkin")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const unsubscribeWorkers = FirebaseService.onWorkersChange((workersData) => {
      setWorkers(workersData)
      setLoading(false)
    })

    const unsubscribeSessions = FirebaseService.onActiveSessionsChange((sessionsData) => {
      setActiveSessions(sessionsData)
    })

    runAutoClose()

    const interval = setInterval(runAutoClose, 5 * 60 * 1000)

    return () => {
      unsubscribeWorkers()
      unsubscribeSessions()
      clearInterval(interval)
    }
  }, [])

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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">VMH Tracker</h1>
                <p className="text-xs sm:text-sm text-gray-500">Sistema di Gestione Presenze</p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-sm font-semibold text-gray-900">VMH</h1>
              </div>
            </div>

            <div className="hidden md:flex flex-1 justify-center">
              <AnimatedClockWeather />
            </div>

            <nav className="flex space-x-1 sm:space-x-2">
              <Button
                variant={currentView === "checkin" ? "default" : "ghost"}
                onClick={() => setCurrentView("checkin")}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 text-xs sm:text-sm"
                size="sm"
              >
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Presenze</span>
                <span className="sm:hidden">Check</span>
              </Button>
              <Button
                variant={currentView === "admin" ? "default" : "ghost"}
                onClick={() => setCurrentView("admin")}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 text-xs sm:text-sm"
                size="sm"
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Admin</span>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
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
          <div className="space-y-4 sm:space-y-8">
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <Card className="bg-white/60 backdrop-blur-sm border-green-200/50">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-green-700 flex items-center space-x-2 text-sm sm:text-base">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Lavoratori Attivi</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {activeSessions.map((session) => (
                      <div
                        key={session.workerId}
                        className="bg-white/80 rounded-xl p-3 sm:p-4 border border-green-200/50"
                      >
                        <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="font-medium text-gray-900 text-sm sm:text-base">{session.workerName}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">Entrata: {session.checkIn}</p>
                        <Button
                          onClick={() => handleCheckOut(session.workerId)}
                          className="w-full bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm py-2"
                          size="sm"
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
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-gray-900 text-sm sm:text-base">Seleziona Lavoratore</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6 lg:gap-8">
                  {workers.map((worker) => {
                    const isActive = isWorkerActive(worker.id)
                    return (
                      <button
                        key={worker.id}
                        onClick={() => !isActive && handleCheckIn(worker)}
                        disabled={isActive}
                        className={`group relative p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl transition-all duration-200 ${
                          isActive
                            ? "bg-green-50 border-2 border-green-200 cursor-not-allowed"
                            : "bg-white/80 hover:bg-white hover:shadow-lg border-2 border-gray-200/50 hover:border-blue-300 active:scale-95"
                        }`}
                      >
                        <div className="flex flex-col items-center space-y-2 sm:space-y-3 lg:space-y-4">
                          <div className={`relative ${isActive ? "opacity-60" : ""}`}>
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 lg:h-32 lg:w-32 ring-2 sm:ring-4 ring-white shadow-lg">
                              <AvatarImage
                                src={worker.imageUrl || "/placeholder.svg"}
                                alt={worker.name}
                                className="object-cover object-center w-full h-full"
                              />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm sm:text-lg lg:text-xl">
                                {worker.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            {isActive && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 bg-green-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base leading-tight">
                              {worker.name}
                            </p>
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

        {currentView === "admin" && <AdminPanel onDataChange={() => {}} />}
      </main>

      <PWAInstallButton />
    </div>
  )
}
