"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Clock } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Worker, TimeEntry } from "@/lib/types"
import { ReportFilters } from "./report-filters"

export function ReportsPanel() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportType, setReportType] = useState<"week" | "month" | "year" | "custom">("week")
  const [loading, setLoading] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)

  useEffect(() => {
    loadWorkers()
  }, [])

  const loadWorkers = async () => {
    try {
      const workersData = await FirebaseService.getWorkers()
      setWorkers(workersData)
    } catch (error) {
      console.error("Error loading workers:", error)
    }
  }

  const loadReport = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    setReportGenerated(false)
    try {
      const entries = await FirebaseService.getTimeEntries(
        startDate,
        endDate,
        selectedWorker === "all" ? undefined : selectedWorker,
      )
      setTimeEntries(entries)
      setReportGenerated(true)
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
      <ReportFilters
        reportType={reportType}
        setReportType={setReportType}
        selectedWorker={selectedWorker}
        setSelectedWorker={setSelectedWorker}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        workers={workers}
        onGenerateReport={loadReport}
        onExportCSV={exportToCSV}
        loading={loading}
        hasData={timeEntries.length > 0}
      />

      {reportGenerated && timeEntries.length === 0 && (
        <Card className="bg-white/60 backdrop-blur-sm border-orange-200/50">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center">
                <Calendar className="h-8 w-8 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nessun Dato Trovato</h3>
                <p className="text-gray-600 mt-2">
                  Non sono state trovate presenze per il periodo selezionato
                  <br />
                  <span className="font-medium">
                    {new Date(startDate).toLocaleDateString("it-IT")} - {new Date(endDate).toLocaleDateString("it-IT")}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {timeEntries.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Rapporto Generato</h2>
                <p className="text-gray-600">
                  Periodo: {new Date(startDate).toLocaleDateString("it-IT")} -{" "}
                  {new Date(endDate).toLocaleDateString("it-IT")}
                  {selectedWorker !== "all" && (
                    <span className="ml-2">• Lavoratore: {workers.find((w) => w.id === selectedWorker)?.name}</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{getTotalHours().toFixed(1)} ore</p>
                <p className="text-sm text-gray-600">{timeEntries.length} presenze</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
