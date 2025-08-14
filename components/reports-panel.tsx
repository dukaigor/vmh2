"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Download, Clock } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Worker, TimeEntry } from "@/lib/types"

export function ReportsPanel() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportType, setReportType] = useState<"week" | "month" | "year" | "custom">("week")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadWorkers()
    setDefaultDates()
  }, [])

  useEffect(() => {
    if (reportType !== "custom") {
      setDefaultDates()
    }
  }, [reportType])

  const loadWorkers = async () => {
    try {
      const workersData = await FirebaseService.getWorkers()
      setWorkers(workersData)
    } catch (error) {
      console.error("Error loading workers:", error)
    }
  }

  const setDefaultDates = () => {
    const now = new Date()
    let start: Date
    const end = new Date()

    switch (reportType) {
      case "week":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
        break
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "year":
        start = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return
    }

    setStartDate(start.toISOString().split("T")[0])
    setEndDate(end.toISOString().split("T")[0])
  }

  const loadReport = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    try {
      const entries = await FirebaseService.getTimeEntries(
        startDate,
        endDate,
        selectedWorker === "all" ? undefined : selectedWorker,
      )
      setTimeEntries(entries)
    } catch (error) {
      console.error("Error loading report:", error)
    } finally {
      setLoading(false)
    }
  }

  const getTotalHours = () => {
    return timeEntries.reduce((total, entry) => total + (entry.hoursWorked || 0), 0)
  }

  const getWorkerHours = (workerId: string) => {
    return timeEntries
      .filter((entry) => entry.workerId === workerId)
      .reduce((total, entry) => total + (entry.hoursWorked || 0), 0)
  }

  const exportToCSV = () => {
    const headers = ["Data", "Lavoratore", "Entrata", "Uscita", "Ore Lavorate", "Note"]
    const csvContent = [
      headers.join(","),
      ...timeEntries.map((entry) =>
        [
          entry.date,
          entry.workerName,
          entry.checkIn,
          entry.checkOut || "In corso",
          entry.hoursWorked?.toFixed(2) || "0",
          entry.isAutoClose ? "Chiusura Auto" : entry.isManualEntry ? "Aggiunto Manualmente" : entry.notes || "Normale",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapporto-presenze-${startDate}-${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Report Filters */}
      <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Filtri Rapporto</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="reportType">Periodo</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Questa Settimana</SelectItem>
                  <SelectItem value="month">Questo Mese</SelectItem>
                  <SelectItem value="year">Quest'Anno</SelectItem>
                  <SelectItem value="custom">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="worker">Lavoratore</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i Lavoratori</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">Data Inizio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={reportType !== "custom"}
              />
            </div>

            <div>
              <Label htmlFor="endDate">Data Fine</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={reportType !== "custom"}
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <Button onClick={loadReport} disabled={loading}>
              {loading ? "Caricamento..." : "Genera Rapporto"}
            </Button>
            {timeEntries.length > 0 && (
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Esporta CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {timeEntries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/60 backdrop-blur-sm border-blue-200/50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Ore Totali</p>
                  <p className="text-2xl font-bold text-blue-600">{getTotalHours().toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-green-200/50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Giorni Lavorativi</p>
                  <p className="text-2xl font-bold text-green-600">
                    {new Set(timeEntries.map((entry) => entry.date)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-purple-200/50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {timeEntries.length}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Presenze Totali</p>
                  <p className="text-2xl font-bold text-purple-600">{timeEntries.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Report Table */}
      {timeEntries.length > 0 && (
        <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
          <CardHeader>
            <CardTitle>Dettaglio Presenze</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lavoratore</TableHead>
                    <TableHead>Entrata</TableHead>
                    <TableHead>Uscita</TableHead>
                    <TableHead>Ore Lavorate</TableHead>
                    <TableHead className="min-w-[120px]">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell className="font-medium">{entry.workerName}</TableCell>
                      <TableCell>{entry.checkIn}</TableCell>
                      <TableCell>{entry.checkOut || "In corso"}</TableCell>
                      <TableCell>{entry.hoursWorked?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {entry.isAutoClose && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full whitespace-nowrap">
                              Chiusura Auto
                            </span>
                          )}
                          {entry.isManualEntry && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full whitespace-nowrap">
                              Aggiunto Manualmente
                            </span>
                          )}
                          {entry.notes && (
                            <span className="text-xs text-gray-600 italic block mt-1">{entry.notes}</span>
                          )}
                          {!entry.isAutoClose && !entry.isManualEntry && !entry.notes && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full whitespace-nowrap">
                              Normale
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Worker Summary */}
      {selectedWorker === "all" && timeEntries.length > 0 && (
        <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
          <CardHeader>
            <CardTitle>Riepilogo per Lavoratore</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workers.map((worker) => {
                const hours = getWorkerHours(worker.id)
                const entries = timeEntries.filter((entry) => entry.workerId === worker.id).length
                if (hours === 0) return null

                return (
                  <div key={worker.id} className="flex items-center justify-between p-3 bg-white/80 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <img
                        src={worker.imageUrl || "/placeholder.svg"}
                        alt={worker.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="font-medium">{worker.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{hours.toFixed(1)} ore</p>
                      <p className="text-sm text-gray-600">{entries} presenze</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
