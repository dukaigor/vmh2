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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus, Edit, Lock, Clock, Zap, User, DollarSign, TrendingUp } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Worker, TimeEntry } from "@/lib/types"
import { ReportsPro } from "@/components/reports-pro"

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
      setError("Errore nel caricamento dei lavoratori")
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

  const handleAutoClose = async () => {
    setLoading(true)
    try {
      const result = await FirebaseService.autoCloseSessions()
      setSuccess(result.message)
      setTimeout(() => setSuccess(""), 5000)
    } catch (error) {
      setError("Errore nell'eseguire la chiusura automatica")
    } finally {
      setLoading(false)
    }
  }

  const handleForceCloseAll = async () => {
    if (!confirm("Sei sicuro di voler chiudere tutte le sessioni attive?")) return
    setLoading(true)
    try {
      const result = await FirebaseService.forceCloseAllSessions()
      setSuccess(result.message)
      setTimeout(() => setSuccess(""), 5000)
    } catch (error) {
      setError("Errore nella chiusura forzata")
    } finally {
      setLoading(false)
    }
  }

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
          <TabsTrigger value="reports-pro">
            <TrendingUp className="h-4 w-4 mr-2" />
            RAPORT PRO
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
                <Button variant="outline" onClick={handleAutoClose} disabled={loading}>
                  <Zap className="h-4 w-4 mr-2" />
                  Esegui Chiusura Automatica
                </Button>
                <Button variant="destructive" onClick={handleForceCloseAll} disabled={loading}>
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

        <TabsContent value="reports-pro" className="space-y-6">
          <ReportsPro workers={workers} />
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
