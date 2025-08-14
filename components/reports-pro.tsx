"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar, Clock, DollarSign, Download, TrendingUp, Users, BarChart3, Edit, Trash2 } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Worker, TimeEntry } from "@/lib/types"

interface ReportsProProps {
  workers: Worker[]
}

export function ReportsPro({ workers }: ReportsProProps) {
  const [reportType, setReportType] = useState<"week" | "month" | "year" | "custom">("month")
  const [selectedWorker, setSelectedWorker] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState({ date: "", checkIn: "", checkOut: "" })
  const [deleteEntry, setDeleteEntry] = useState<TimeEntry | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Calculate correct dates for Milan timezone
  const calculateDates = (type: "week" | "month" | "year") => {
    const now = new Date()

    switch (type) {
      case "week": {
        // Monday to Sunday
        const dayOfWeek = now.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const monday = new Date(now)
        monday.setDate(now.getDate() - daysFromMonday)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        return {
          start: monday.toISOString().split("T")[0],
          end: sunday.toISOString().split("T")[0],
        }
      }
      case "month": {
        const year = now.getFullYear()
        const month = now.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0) // 0th day of next month = last day of current month

        return {
          start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
          end: `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
        }
      }
      case "year": {
        const year = now.getFullYear()

        return {
          start: `${year}-01-01`,
          end: `${year}-12-31`,
        }
      }
    }
  }

  // Set default dates when report type changes
  useEffect(() => {
    if (reportType !== "custom") {
      const dates = calculateDates(reportType)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }, [reportType])

  // Load report data
  const loadReport = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    try {
      const workerFilter = selectedWorker === "all" ? undefined : selectedWorker
      const entries = await FirebaseService.getTimeEntries(startDate, endDate, workerFilter)
      setTimeEntries(entries)
    } catch (error) {
      console.error("Error loading report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setEditForm({
      date: entry.date,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingEntry || !editForm.date || !editForm.checkIn || !editForm.checkOut) return

    setActionLoading(true)
    try {
      const result = await FirebaseService.updateTimeEntry(
        editingEntry.id,
        editForm.checkIn,
        editForm.checkOut,
        editForm.date,
      )

      if (result.success) {
        setEditingEntry(null)
        await loadReport() // Reload data
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error("Error updating entry:", error)
      alert("Errore durante la modifica")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return

    setActionLoading(true)
    try {
      await FirebaseService.deleteTimeEntry(deleteEntry.id)
      setDeleteEntry(null)
      await loadReport() // Reload data
    } catch (error) {
      console.error("Error deleting entry:", error)
      alert("Errore durante l'eliminazione")
    } finally {
      setActionLoading(false)
    }
  }

  // Calculate totals
  const getTotalHours = () => timeEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0)
  const getTotalEarnings = () => {
    return timeEntries.reduce((sum, entry) => {
      const worker = workers.find((w) => w.id === entry.workerId)
      return sum + (entry.hoursWorked || 0) * (worker?.hourlyRate || 0)
    }, 0)
  }

  // Group entries by worker
  const getWorkerStats = () => {
    const stats = workers
      .map((worker) => {
        const workerEntries = timeEntries.filter((entry) => entry.workerId === worker.id)
        const totalHours = workerEntries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0)
        const totalEarnings = totalHours * (worker.hourlyRate || 0)
        const totalDays = new Set(workerEntries.map((entry) => entry.date)).size

        return {
          worker,
          totalHours,
          totalEarnings,
          totalDays,
          totalEntries: workerEntries.length,
          avgHoursPerDay: totalDays > 0 ? totalHours / totalDays : 0,
        }
      })
      .filter((stat) => stat.totalHours > 0)

    return stats.sort((a, b) => b.totalHours - a.totalHours)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Data", "Lavoratore", "Entrata", "Uscita", "Ore", "Paga Oraria", "Guadagno", "Note"]
    const rows = timeEntries.map((entry) => {
      const worker = workers.find((w) => w.id === entry.workerId)
      const earnings = (entry.hoursWorked || 0) * (worker?.hourlyRate || 0)
      const notes = entry.isAutoClose ? "Chiusura Auto" : entry.isManualEntry ? "Aggiunto Manualmente" : "Normale"

      return [
        new Date(entry.date).toLocaleDateString("it-IT"),
        entry.workerName,
        entry.checkIn,
        entry.checkOut || "In corso",
        (entry.hoursWorked || 0).toFixed(2),
        `€${(worker?.hourlyRate || 0).toFixed(2)}`,
        `€${earnings.toFixed(2)}`,
        notes,
      ]
    })

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapporto-pro-${startDate}-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>RAPORT PRO - Analisi Avanzata</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Periodo</Label>
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
              <Label>Lavoratore</Label>
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
              <Label>Data Inizio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={reportType !== "custom"}
              />
            </div>

            <div>
              <Label>Data Fine</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={reportType !== "custom"}
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <Button onClick={loadReport} disabled={loading}>
              {loading ? "Caricamento..." : "Genera Rapporto PRO"}
            </Button>
            {timeEntries.length > 0 && (
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Esporta CSV Dettagliato
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Statistics */}
      {timeEntries.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Ore Totali</p>
                    <p className="text-3xl font-bold">{getTotalHours().toFixed(1)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Guadagno Totale</p>
                    <p className="text-3xl font-bold">€{getTotalEarnings().toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Giorni Lavorativi</p>
                    <p className="text-3xl font-bold">{new Set(timeEntries.map((entry) => entry.date)).size}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100">Media Ore/Giorno</p>
                    <p className="text-3xl font-bold">
                      {(getTotalHours() / new Set(timeEntries.map((entry) => entry.date)).size).toFixed(1)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Worker Performance Analysis */}
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Analisi Performance per Lavoratore</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lavoratore</TableHead>
                      <TableHead>Ore Totali</TableHead>
                      <TableHead>Giorni Lavorativi</TableHead>
                      <TableHead>Media Ore/Giorno</TableHead>
                      <TableHead>Paga Oraria</TableHead>
                      <TableHead>Guadagno Totale</TableHead>
                      <TableHead>Presenze</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getWorkerStats().map((stat) => (
                      <TableRow key={stat.worker.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <img
                              src={stat.worker.imageUrl || "/placeholder.svg"}
                              alt={stat.worker.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span>{stat.worker.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{stat.totalHours.toFixed(1)}</TableCell>
                        <TableCell>{stat.totalDays}</TableCell>
                        <TableCell>{stat.avgHoursPerDay.toFixed(1)}</TableCell>
                        <TableCell>€{(stat.worker.hourlyRate || 0).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold text-green-600">€{stat.totalEarnings.toFixed(2)}</TableCell>
                        <TableCell>{stat.totalEntries}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Entries Table */}
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
            <CardHeader>
              <CardTitle>
                Dettaglio Entrate - Periodo: {startDate} / {endDate}
              </CardTitle>
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
                      <TableHead>Ore</TableHead>
                      <TableHead>Guadagno</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-center">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => {
                      const worker = workers.find((w) => w.id === entry.workerId)
                      const earnings = (entry.hoursWorked || 0) * (worker?.hourlyRate || 0)

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{new Date(entry.date).toLocaleDateString("it-IT")}</TableCell>
                          <TableCell className="font-medium">{entry.workerName}</TableCell>
                          <TableCell>{entry.checkIn}</TableCell>
                          <TableCell>{entry.checkOut || "In corso"}</TableCell>
                          <TableCell className="font-semibold">{(entry.hoursWorked || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-semibold text-green-600">€{earnings.toFixed(2)}</TableCell>
                          <TableCell>
                            {entry.isAutoClose && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Chiusura Auto
                              </span>
                            )}
                            {entry.isManualEntry && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Aggiunto Manualmente
                              </span>
                            )}
                            {!entry.isAutoClose && !entry.isManualEntry && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Normale
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditEntry(entry)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteEntry(entry)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* No Data Message */}
      {timeEntries.length === 0 && !loading && startDate && endDate && (
        <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">Nessun dato trovato per il periodo selezionato</p>
            <p className="text-sm text-gray-500 mt-2">Prova a modificare i filtri o il periodo di ricerca</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Entrata</DialogTitle>
            <DialogDescription>Modifica gli orari di entrata e uscita per {editingEntry?.workerName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Orario Entrata</Label>
              <Input
                type="time"
                value={editForm.checkIn}
                onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
              />
            </div>
            <div>
              <Label>Orario Uscita</Label>
              <Input
                type="time"
                value={editForm.checkOut}
                onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Annulla
            </Button>
            <Button onClick={handleSaveEdit} disabled={actionLoading}>
              {actionLoading ? "Salvando..." : "Salva Modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare l'entrata di {deleteEntry?.workerName} del{" "}
              {deleteEntry && new Date(deleteEntry.date).toLocaleDateString("it-IT")}?
              <br />
              <strong>Questa azione non può essere annullata.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDeleteEntry} disabled={actionLoading}>
              {actionLoading ? "Eliminando..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
