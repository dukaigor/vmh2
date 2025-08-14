"use client"

import React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  Button,
} from "./ui-components" // Adjust import paths as necessary
import { Calendar, Download } from "lucide-react" // Adjust import paths as necessary

export function ReportFilters({
  reportType,
  setReportType,
  selectedWorker,
  setSelectedWorker,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  workers,
  onGenerateReport,
  onExportCSV,
  loading,
  hasData,
}: {
  reportType: "week" | "month" | "year" | "custom"
  setReportType: (type: "week" | "month" | "year" | "custom") => void
  selectedWorker: string
  setSelectedWorker: (worker: string) => void
  startDate: string
  setStartDate: (date: string) => void
  endDate: string
  setEndDate: (date: string) => void
  workers: any[]
  onGenerateReport: () => void
  onExportCSV: () => void
  loading: boolean
  hasData: boolean
}) {
  const updateDatesForPeriod = (period: "week" | "month" | "year" | "custom") => {
    if (period === "custom") return

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    const currentDate = now.getDate()

    let start: string, end: string

    if (period === "week") {
      // Calculate Monday to Sunday of current week
      const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      const monday = new Date(currentYear, currentMonth, currentDate - daysToMonday)
      const sunday = new Date(currentYear, currentMonth, currentDate - daysToMonday + 6)

      start = monday.toISOString().split("T")[0]
      end = sunday.toISOString().split("T")[0]
    } else if (period === "month") {
      // First day to last day of current month
      const firstDay = new Date(currentYear, currentMonth, 1)
      const lastDay = new Date(currentYear, currentMonth + 1, 0) // 0th day of next month = last day of current month

      start = firstDay.toISOString().split("T")[0]
      end = lastDay.toISOString().split("T")[0]
    } else if (period === "year") {
      // January 1st to December 31st of current year
      const firstDay = new Date(currentYear, 0, 1) // January 1st
      const lastDay = new Date(currentYear, 11, 31) // December 31st

      start = firstDay.toISOString().split("T")[0]
      end = lastDay.toISOString().split("T")[0]
    }

    setStartDate(start!)
    setEndDate(end!)
  }

  const handlePeriodChange = (newPeriod: "week" | "month" | "year" | "custom") => {
    setReportType(newPeriod)
    updateDatesForPeriod(newPeriod)
  }

  // Initialize dates when component mounts
  React.useEffect(() => {
    updateDatesForPeriod(reportType)
  }, [])

  return (
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
            <Select value={reportType} onValueChange={handlePeriodChange}>
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
          <Button onClick={onGenerateReport} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? "Caricamento..." : "Genera Rapporto"}
          </Button>
          {hasData && (
            <Button variant="outline" onClick={onExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Esporta CSV
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
