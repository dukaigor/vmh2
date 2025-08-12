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
import { Trash2, Plus, Edit, Lock, Clock, Zap, Calendar, Download, BarChart3 } from "lucide-react"
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
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [newWorker, setNewWorker] = useState({ name: "", imageUrl: "" })
  const [autoCloseSettings, setAutoCloseSettings] = useState({ time: "18:00", enabled: true })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reportType, setReportType] = useState<"week" | "month" | "year" | "custom">("week")
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
          (entry as any).autoClose ? "Chiusura Automatica" : "",
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

  const handleSaveAutoCloseSettings = async () => {
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
  }

  const handleRunAutoClose = async () => {
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
  }

  const handleForceCloseAll = async () => {
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
  }

  const handleAddWorker = async () => {
    if (!newWorker.name.trim()) {
      setError("Il nome è obbligatorio")
      return
    }

    try {
      await FirebaseService.addWorker(newWorker.name, newWorker.imageUrl)
      setNewWorker({ name: "", imageUrl: "" })
      setIsAddDialogOpen(false)
      await loadWorkers()
      onDataChange()
      setError("")
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
      await FirebaseService.updateWorker(editingWorker.id, editingWorker.name, editingWorker.imageUrl)
      setEditingWorker(null)
      await loadWorkers()
      onDataChange()
      setError("")
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
      } catch (error) {
        setError("Errore nell'eliminare il lavoratore")
      }
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workers">Gestione Lavoratori</TabsTrigger>
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
                      <span className="font-medium">{worker.name}</span>
                    </div>
                    <div className="flex space-x-2">
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
                <Button onClick={handleSaveAutoCloseSettings} disabled={loading}>
                  {loading ? "Salvando..." : "Salva Impostazioni"}
                </Button>
                <Button variant="outline" onClick={handleRunAutoClose} disabled={loading}>
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
                        <TableHead>Note</TableHead>
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
                            {(entry as any).autoClose && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                Chiusura Auto
                              </span>
                            )}
                            {(entry as any).manualClose && (
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                Chiusura Manuale
                              </span>
                            )}
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
              <Button onClick={handleEditWorker} className="w-full">
                Salva Modifiche
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
