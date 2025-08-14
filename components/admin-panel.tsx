"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus, Edit, Lock, Clock, Zap, Calendar, Download, BarChart3, User, DollarSign } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Worker, TimeEntry } from "@/lib/types"

interface AdminPanelProps {
  onDataChange: () => void
}

export function AdminPanel({ onDataChange }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [selectedWorkerProfile, setSelectedWorkerProfile] = useState<Worker | null>(null)
  const [newWorker, setNewWorker] = useState({ name: "", imageUrl: "", hourlyRate: 0 })
  const [manualEntry, setManualEntry] = useState({
    workerId: "",
    workerName: "",
    date: "",
    checkIn: "",
    checkOut: "",
  })
  const [autoCloseSettings, setAutoCloseSettings] = useState({ time: "18:00", enabled: true })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [groupedEntries, setGroupedEntries] = useState<{ [key: string]: TimeEntry[] }>({})
  const [selectedWorker, setSelectedWorker] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportType, setReportType] = useState<"week" | "month" | "year" | "custom">("month")
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadWorkers()
      loadAutoCloseSettings()
      setDefaultDates()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (reportType !== "custom") {
      setDefaultDates()
    }
  }, [reportType])

  const handleLogin = () => {
    if (password === "1309") {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("Password non corretta")
    }
  }

  const loadWorkers = async () => {
    try {
      const workersData = await FirebaseService.getWorkers()
      setWorkers(workersData)
    } catch (error) {
      console.error("Error loading workers:", error)
    }
  }

  const loadAutoCloseSettings = async () => {
    try {
      const settings = await FirebaseService.getAutoCloseSettings()
      setAutoCloseSettings(settings)
    } catch (error) {
      console.error("Error loading auto-close settings:", error)
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

    setReportLoading(true)
    try {
      const entries = await FirebaseService.getTimeEntries(
        startDate,
        endDate,
        selectedWorker === "all" ? undefined : selectedWorker,
      )
      setTimeEntries(entries)

      // Load grouped entries for better organization
      const grouped = await FirebaseService.getTimeEntriesGroupedByMonth(
        selectedWorker === "all" ? undefined : selectedWorker,
      )
      setGroupedEntries(grouped)
    } catch (error) {
      console.error("Error loading report:", error)
      setError("Errore nel caricamento del rapporto")
    } finally {
      setReportLoading(false)
    }
  }

  const getTotalHours = () => {
    return timeEntries.reduce((total, entry) => total + (entry.hoursWorked || 0), 0)
  }

  const getTotalEarnings = () => {
    return timeEntries.reduce((total, entry) => {
      const worker = workers.find((w) => w.id === entry.workerId)
      const hourlyRate = worker?.hourlyRate || 0
      return total + (entry.hoursWorked || 0) * hourlyRate
    }, 0)
  }

  const getWorkerHours = (workerId: string) => {
    return timeEntries
      .filter((entry) => entry.workerId === workerId)
      .reduce((total, entry) => total + (entry.hoursWorked || 0), 0)
  }

  const getWorkerEarnings = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    const hourlyRate = worker?.hourlyRate || 0
    return getWorkerHours(workerId) * hourlyRate
  }

  const exportToCSV = () => {
    const headers = ["Data", "Lavoratore", "Entrata", "Uscita", "Ore Lavorate", "Paga Oraria", "Guadagno", "Note"]
    const csvContent = [
      headers.join(","),
      ...timeEntries.map((entry) => {
        const worker = workers.find((w) => w.id === entry.workerId)
        const hourlyRate = worker?.hourlyRate || 0
        const earnings = (entry.hoursWorked || 0) * hourlyRate
        return [
          entry.date,
          entry.workerName,
          entry.checkIn,
          entry.checkOut || "In corso",
          entry.hoursWorked?.toFixed(2) || "0",
          `€${hourlyRate.toFixed(2)}`,
          `€${earnings.toFixed(2)}`,
          (entry as any).autoClose ? "Chiusura Automatica" : (entry as any).manualEntry ? "Entrata Manuale" : "",
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapporto-presenze-${startDate}-${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleAddWorker = async () => {
    if (!newWorker.name.trim()) {
      setError("Il nome è obbligatorio")
      return
    }

    try {
      await FirebaseService.addWorker(newWorker.name, newWorker.imageUrl, newWorker.hourlyRate)
      setNewWorker({ name: "", imageUrl: "", hourlyRate: 0 })
      setIsAddDialogOpen(false)
      await loadWorkers()
      onDataChange()
      setError("")
      setSuccess("Lavoratore aggiunto con successo")
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      setError("Errore nell'aggiungere il lavoratore")
    }
  }

  const handleEditWorker = async () => {
    if (!editingWorker || !editingWorker.name.trim()) {
      setError("Il nome è obbligatorio")
      return
    }

    try {
      await FirebaseService.updateWorker(
        editingWorker.id,
        editingWorker.name,
        editingWorker.imageUrl,
        editingWorker.hourlyRate,
      )
      setEditingWorker(null)
      await loadWorkers()
      onDataChange()
      setError("")
      setSuccess("Lavoratore modificato con successo")
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      setError("Errore nell'aggiornare il lavoratore")
    }
  }

  const handleDeleteWorker = async (workerId: string) => {
    if (confirm("Sei sicuro di voler eliminare questo lavoratore?")) {
      try {
        await FirebaseService.deleteWorker(workerId)
        await loadWorkers()
        onDataChange()
        setSuccess("Lavoratore eliminato con successo")
        setTimeout(() => setSuccess(""), 3000)
      } catch (error) {
        setError("Errore nell'eliminare il lavoratore")
      }
    }
  }

  const handleAddManualEntry = async () => {
    if (!manualEntry.workerId || !manualEntry.date || !manualEntry.checkIn || !manualEntry.checkOut) {
      setError("Tutti i campi sono obbligatori")
      return
    }

    try {
      const result = await FirebaseService.addManualTimeEntry(
        manualEntry.workerId,
        manualEntry.workerName,
        manualEntry.date,
        manualEntry.checkIn,
        manualEntry.checkOut,
      )

      if (result.success) {
        setManualEntry({ workerId: "", workerName: "", date: "", checkIn: "", checkOut: "" })
        setIsManualEntryOpen(false)
        setSuccess(result.message)
        setTimeout(() => setSuccess(""), 3000)
        loadReport() // Refresh the report
      } else {
        setError(result.message)
      }
    } catch (error) {
      setError("Errore nell'aggiungere l'entrata manuale")
    }
  }

  const handleEditEntry = async () => {
    if (!editingEntry || !editingEntry.checkIn || !editingEntry.checkOut || !editingEntry.date) {
      setError("Tutti i campi sono obbligatori")
      return
    }

    try {
      const result = await FirebaseService.updateTimeEntry(
        editingEntry.id!,
        editingEntry.checkIn,
        editingEntry.checkOut,
        editingEntry.date,
      )

      if (result.success) {
        setEditingEntry(null)
        setSuccess(result.message)
        setTimeout(() => setSuccess(""), 3000)
        loadReport() // Refresh the report
      } else {
        setError(result.message)
      }
    } catch (error) {
      setError("Errore nella modifica dell'entrata")
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm("Sei sicuro di voler eliminare questa entrata?")) {
      try {
        await FirebaseService.deleteTimeEntry(entryId)
        setSuccess("Entrata eliminata con successo")
        setTimeout(() => setSuccess(""), 3000)
        loadReport() // Refresh the report
      } catch (error) {
        setError("Errore nell'eliminare l'entrata")
      }
    }
  }

  // ... existing code for auto-close functions ...

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto bg-white/60 backdrop-blur-sm border-gray-200/50">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Accesso Admin</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Inserisci la password"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleLogin} className="w-full">
            Accedi
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="workers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workers">Gestione Lavoratori</TabsTrigger>
          <TabsTrigger value="entries">Gestione Entrate</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            Rapporti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-6">
          {/* Workers Management */}
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gestione Lavoratori</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Aggiungi Lavoratore</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Nuovo Lavoratore</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workerName">Nome</Label>
                      <Input
                        id="workerName"
                        value={newWorker.name}
                        onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                        placeholder="Nome del lavoratore"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workerImage">URL Immagine</Label>
                      <Input
                        id="workerImage"
                        value={newWorker.imageUrl}
                        onChange={(e) => setNewWorker({ ...newWorker, imageUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="hourlyRate">Paga Oraria (€)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={newWorker.hourlyRate}
                        onChange={(e) =>
                          setNewWorker({ ...newWorker, hourlyRate: Number.parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <Button onClick={handleAddWorker} className="w-full">
                      Aggiungi
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between p-3 bg-white/80 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <img
                        src={worker.imageUrl || "/placeholder.svg"}
                        alt={worker.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <span className="font-medium">{worker.name}</span>
                        <p className="text-sm text-gray-600">€{(worker.hourlyRate || 0).toFixed(2)}/ora</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWorkerProfile(worker)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <User className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingWorker(worker)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteWorker(worker.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-6">
          {/* Manual Entry Management */}
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gestione Entrate</CardTitle>
              <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Aggiungi Entrata Manuale</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi Entrata Manuale</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="manualWorker">Lavoratore</Label>
                      <Select
                        value={manualEntry.workerId}
                        onValueChange={(value) => {
                          const worker = workers.find((w) => w.id === value)
                          setManualEntry({
                            ...manualEntry,
                            workerId: value,
                            workerName: worker?.name || "",
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona lavoratore" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="manualDate">Data</Label>
                      <Input
                        id="manualDate"
                        type="date"
                        value={manualEntry.date}
                        onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="manualCheckIn">Entrata</Label>
                        <Input
                          id="manualCheckIn"
                          type="time"
                          value={manualEntry.checkIn}
                          onChange={(e) => setManualEntry({ ...manualEntry, checkIn: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="manualCheckOut">Uscita</Label>
                        <Input
                          id="manualCheckOut"
                          type="time"
                          value={manualEntry.checkOut}
                          onChange={(e) => setManualEntry({ ...manualEntry, checkOut: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddManualEntry} className="w-full">
                      Aggiungi Entrata
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg mb-4">
                <p className="font-medium mb-1">Gestione Entrate:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Ogni lavoratore può avere solo una entrata per giorno</li>
                  <li>Le entrate manuali vengono contrassegnate nel sistema</li>
                  <li>È possibile modificare o eliminare qualsiasi entrata esistente</li>
                  <li>I calcoli delle ore e della paga vengono aggiornati automaticamente</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* Auto Close Settings */}
          <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Impostazioni Chiusura Automatica</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="autoCloseTime">Orario di chiusura automatica</Label>
                  <Input
                    id="autoCloseTime"
                    type="time"
                    value={autoCloseSettings.time}
                    onChange={(e) => setAutoCloseSettings({ ...autoCloseSettings, time: e.target.value })}
                    className="max-w-xs"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <Switch
                    checked={autoCloseSettings.enabled}
                    onCheckedChange={(enabled) => setAutoCloseSettings({ ...autoCloseSettings, enabled })}
                  />
                  <Label>Abilita chiusura automatica</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await FirebaseService.updateAutoCloseSettings(autoCloseSettings.time, autoCloseSettings.enabled)
                      setSuccess("Impostazioni salvate con successo")
                      setTimeout(() => setSuccess(""), 3000)
                    } catch (error) {
                      setError("Errore nel salvare le impostazioni")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Salva Impostazioni"}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const result = await FirebaseService.autoCloseSessions()
                      setSuccess(result.message)
                      onDataChange()
                      setTimeout(() => setSuccess(""), 5000)
                    } catch (error) {
                      setError("Errore nell'eseguire la chiusura automatica")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Esegui Chiusura Automatica
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm("Sei sicuro di voler chiudere tutte le sessioni attive?")) return
                    setLoading(true)
                    try {
                      const result = await FirebaseService.forceCloseAllSessions()
                      setSuccess(result.message)
                      onDataChange()
                      setTimeout(() => setSuccess(""), 5000)
                    } catch (error) {
                      setError("Errore nella chiusura forzata")
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  Chiudi Tutte le Sessioni
                </Button>
              </div>

              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Come funziona:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Le sessioni dei giorni precedenti vengono chiuse automaticamente all'orario impostato</li>
                  <li>Le sessioni di oggi vengono chiuse quando l'orario corrente supera l'orario impostato</li>
                  <li>La chiusura automatica viene eseguita ogni volta che si carica la pagina</li>
                  <li>Puoi eseguire manualmente la chiusura automatica con il pulsante sopra</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
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
                <Button onClick={loadReport} disabled={reportLoading}>
                  {reportLoading ? "Caricamento..." : "Genera Rapporto"}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <DollarSign className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Guadagno Totale</p>
                      <p className="text-2xl font-bold text-green-600">€{getTotalEarnings().toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur-sm border-purple-200/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-sm text-gray-600">Giorni Lavorativi</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {new Set(timeEntries.map((entry) => entry.date)).size}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur-sm border-orange-200/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                      {timeEntries.length}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Presenze Totali</p>
                      <p className="text-2xl font-bold text-orange-600">{timeEntries.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Monthly Grouped Entries */}
          {Object.keys(groupedEntries).length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedEntries).map(([month, entries]) => (
                <Card key={month} className="bg-white/60 backdrop-blur-sm border-gray-200/50">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {month} - {entries.length} presenze -{" "}
                      {entries.reduce((sum, entry) => sum + (entry.hoursWorked || 0), 0).toFixed(1)} ore
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
                            <TableHead>Azioni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry) => {
                            const worker = workers.find((w) => w.id === entry.workerId)
                            const earnings = (entry.hoursWorked || 0) * (worker?.hourlyRate || 0)
                            return (
                              <TableRow key={entry.id}>
                                <TableCell>{new Date(entry.date).toLocaleDateString("it-IT")}</TableCell>
                                <TableCell className="font-medium">{entry.workerName}</TableCell>
                                <TableCell>{entry.checkIn}</TableCell>
                                <TableCell>{entry.checkOut || "In corso"}</TableCell>
                                <TableCell>{entry.hoursWorked?.toFixed(2) || "0.00"}</TableCell>
                                <TableCell>€{earnings.toFixed(2)}</TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => setEditingEntry(entry)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteEntry(entry.id!)}
                                      className="text-red-600 hover:text-red-700"
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
              ))}
            </div>
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
                    const earnings = getWorkerEarnings(worker.id)
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
                          <div>
                            <span className="font-medium">{worker.name}</span>
                            <p className="text-sm text-gray-600">€{(worker.hourlyRate || 0).toFixed(2)}/ora</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{hours.toFixed(1)} ore</p>
                          <p className="text-sm text-green-600 font-medium">€{earnings.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{entries} presenze</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {timeEntries.length === 0 && !reportLoading && startDate && endDate && (
            <Card className="bg-white/60 backdrop-blur-sm border-gray-200/50">
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nessun dato trovato per il periodo selezionato</p>
                <p className="text-sm text-gray-500 mt-2">Prova a modificare i filtri o il periodo di ricerca</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Worker Dialog */}
      <Dialog open={!!editingWorker} onOpenChange={() => setEditingWorker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Lavoratore</DialogTitle>
          </DialogHeader>
          {editingWorker && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editWorkerName">Nome</Label>
                <Input
                  id="editWorkerName"
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editWorkerImage">URL Immagine</Label>
                <Input
                  id="editWorkerImage"
                  value={editingWorker.imageUrl}
                  onChange={(e) => setEditingWorker({ ...editingWorker, imageUrl: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editHourlyRate">Paga Oraria (€)</Label>
                <Input
                  id="editHourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingWorker.hourlyRate || 0}
                  onChange={(e) =>
                    setEditingWorker({ ...editingWorker, hourlyRate: Number.parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <Button onClick={handleEditWorker} className="w-full">
                Salva Modifiche
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Entrata</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editEntryDate">Data</Label>
                <Input
                  id="editEntryDate"
                  type="date"
                  value={editingEntry.date}
                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editCheckIn">Entrata</Label>
                  <Input
                    id="editCheckIn"
                    type="time"
                    value={editingEntry.checkIn}
                    onChange={(e) => setEditingEntry({ ...editingEntry, checkIn: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="editCheckOut">Uscita</Label>
                  <Input
                    id="editCheckOut"
                    type="time"
                    value={editingEntry.checkOut || ""}
                    onChange={(e) => setEditingEntry({ ...editingEntry, checkOut: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleEditEntry} className="w-full">
                Salva Modifiche
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Worker Profile Dialog */}
      <Dialog open={!!selectedWorkerProfile} onOpenChange={() => setSelectedWorkerProfile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <img
                src={selectedWorkerProfile?.imageUrl || "/placeholder.svg"}
                alt={selectedWorkerProfile?.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <span>Profilo di {selectedWorkerProfile?.name}</span>
                <p className="text-sm text-gray-600 font-normal">
                  €{(selectedWorkerProfile?.hourlyRate || 0).toFixed(2)}/ora
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedWorkerProfile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-600">
                        {getWorkerHours(selectedWorkerProfile.id).toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-600">Ore Totali</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">
                        €{getWorkerEarnings(selectedWorkerProfile.id).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">Guadagno Totale</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Button
                onClick={() => {
                  setSelectedWorker(selectedWorkerProfile.id)
                  setSelectedWorkerProfile(null)
                  loadReport()
                }}
                className="w-full"
              >
                Visualizza Rapporto Dettagliato
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
