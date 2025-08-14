import { database } from "./firebase"
import { ref, get, set, push, remove, onValue, off } from "firebase/database"
import type { Worker, TimeEntry, WorkSession } from "./types"

export class FirebaseService {
  // Get all workers
  static async getWorkers(): Promise<Worker[]> {
    const workersRef = ref(database, "workers")
    const snapshot = await get(workersRef)

    if (snapshot.exists()) {
      const workersData = snapshot.val()
      return Object.keys(workersData).map((key) => ({
        id: key,
        ...workersData[key],
      }))
    }
    return []
  }

  // Add new worker
  static async addWorker(name: string, imageUrl: string, hourlyRate?: number): Promise<void> {
    const workersRef = ref(database, "workers")
    const newWorkerRef = push(workersRef)
    await set(newWorkerRef, {
      name,
      imageUrl: imageUrl || "",
      hourlyRate: hourlyRate || 0,
    })
  }

  // Update worker
  static async updateWorker(workerId: string, name: string, imageUrl: string, hourlyRate?: number): Promise<void> {
    const workerRef = ref(database, `workers/${workerId}`)
    await set(workerRef, {
      name,
      imageUrl: imageUrl || "",
      hourlyRate: hourlyRate || 0,
    })
  }

  // Delete worker
  static async deleteWorker(workerId: string): Promise<void> {
    const workerRef = ref(database, `workers/${workerId}`)
    await remove(workerRef)
  }

  private static getMilanTime(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }))
  }

  private static formatMilanTime(date: Date): string {
    return date.toLocaleTimeString("it-IT", {
      hour12: false,
      timeZone: "Europe/Rome",
    })
  }

  private static formatMilanDate(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" })
  }

  // Check if worker already has entry for today
  static async hasEntryToday(workerId: string): Promise<boolean> {
    const today = this.formatMilanDate(this.getMilanTime())
    const entriesRef = ref(database, "timeEntries")
    const snapshot = await get(entriesRef)

    if (snapshot.exists()) {
      const entriesData = snapshot.val()
      const todayEntries = Object.values(entriesData).filter(
        (entry: any) => entry.workerId === workerId && entry.date === today,
      )
      return todayEntries.length > 0
    }
    return false
  }

  // Check in worker (with daily limit check)
  static async checkInWorker(worker: Worker): Promise<{ success: boolean; message: string }> {
    // Check if worker already has entry today
    const hasEntry = await this.hasEntryToday(worker.id)
    if (hasEntry) {
      return { success: false, message: "Il lavoratore ha già un'entrata oggi" }
    }

    const now = this.getMilanTime()
    const dateStr = this.formatMilanDate(now)
    const timeStr = this.formatMilanTime(now)

    const sessionRef = ref(database, `activeSessions/${worker.id}`)
    await set(sessionRef, {
      workerId: worker.id,
      workerName: worker.name,
      checkIn: timeStr,
      date: dateStr,
    })

    return { success: true, message: "Check-in effettuato con successo" }
  }

  // Check out worker
  static async checkOutWorker(workerId: string): Promise<void> {
    const sessionRef = ref(database, `activeSessions/${workerId}`)
    const snapshot = await get(sessionRef)

    if (snapshot.exists()) {
      const session = snapshot.val()
      const now = this.getMilanTime()
      const checkOutTime = this.formatMilanTime(now)

      // Calculate hours worked using Milan timezone
      const checkInTime = new Date(`${session.date}T${session.checkIn}`)
      const checkOutDateTime = new Date(`${session.date}T${checkOutTime}`)
      const hoursWorked = (checkOutDateTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      // Save to time entries
      const entriesRef = ref(database, "timeEntries")
      const newEntryRef = push(entriesRef)
      await set(newEntryRef, {
        workerId: session.workerId,
        workerName: session.workerName,
        checkIn: session.checkIn,
        checkOut: checkOutTime,
        date: session.date,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        isAutoClose: false,
        isManualEntry: false,
      })

      // Remove from active sessions
      await set(sessionRef, null)
    }
  }

  // Add manual time entry
  static async addManualTimeEntry(
    workerId: string,
    workerName: string,
    date: string,
    checkIn: string,
    checkOut: string,
  ): Promise<{ success: boolean; message: string }> {
    // Check if worker already has entry for this date
    const entriesRef = ref(database, "timeEntries")
    const snapshot = await get(entriesRef)

    if (snapshot.exists()) {
      const entriesData = snapshot.val()
      const existingEntry = Object.values(entriesData).find(
        (entry: any) => entry.workerId === workerId && entry.date === date,
      )
      if (existingEntry) {
        return { success: false, message: "Il lavoratore ha già un'entrata per questa data" }
      }
    }

    // Calculate hours worked
    const checkInTime = new Date(`${date}T${checkIn}`)
    const checkOutTime = new Date(`${date}T${checkOut}`)
    const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    if (hoursWorked <= 0) {
      return { success: false, message: "L'orario di uscita deve essere successivo all'entrata" }
    }

    const newEntryRef = push(entriesRef)
    await set(newEntryRef, {
      workerId,
      workerName,
      checkIn,
      checkOut,
      date,
      hoursWorked: Math.max(0, Math.round(hoursWorked * 100) / 100),
      isAutoClose: false,
      isManualEntry: true,
    })

    return { success: true, message: "Entrata manuale aggiunta con successo" }
  }

  // Update time entry
  static async updateTimeEntry(
    entryId: string,
    checkIn: string,
    checkOut: string,
    date: string,
  ): Promise<{ success: boolean; message: string }> {
    const checkInTime = new Date(`${date}T${checkIn}`)
    const checkOutTime = new Date(`${date}T${checkOut}`)
    const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    if (hoursWorked <= 0) {
      return { success: false, message: "L'orario di uscita deve essere successivo all'entrata" }
    }

    const entryRef = ref(database, `timeEntries/${entryId}`)
    const snapshot = await get(entryRef)

    if (snapshot.exists()) {
      const existingEntry = snapshot.val()
      await set(entryRef, {
        ...existingEntry,
        checkIn,
        checkOut,
        date,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        notes: "Modificato dall'admin",
      })
      return { success: true, message: "Entrata modificata con successo" }
    }

    return { success: false, message: "Entrata non trovata" }
  }

  // Delete time entry
  static async deleteTimeEntry(entryId: string): Promise<void> {
    const entryRef = ref(database, `timeEntries/${entryId}`)
    await remove(entryRef)
  }

  // Get active sessions
  static async getActiveSessions(): Promise<WorkSession[]> {
    const sessionsRef = ref(database, "activeSessions")
    const snapshot = await get(sessionsRef)

    if (snapshot.exists()) {
      const sessionsData = snapshot.val()
      return Object.values(sessionsData)
    }
    return []
  }

  // Get time entries for reporting (organized by month)
  static async getTimeEntries(startDate?: string, endDate?: string, workerId?: string): Promise<TimeEntry[]> {
    const entriesRef = ref(database, "timeEntries")
    const snapshot = await get(entriesRef)

    if (snapshot.exists()) {
      const entriesData = snapshot.val()
      let entries = Object.keys(entriesData).map((key) => ({
        id: key,
        ...entriesData[key],
      }))

      if (startDate && endDate) {
        const normalizeDate = (dateStr: string): string => {
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/")
            if (parts.length === 3) {
              const day = parts[0].padStart(2, "0")
              const month = parts[1].padStart(2, "0")
              const year = parts[2]
              return `${year}-${month}-${day}`
            }
          }
          return dateStr
        }

        const normalizedStartDate = normalizeDate(startDate)
        const normalizedEndDate = normalizeDate(endDate)

        entries = entries.filter((entry) => {
          if (!entry.date) return false

          const normalizedEntryDate = normalizeDate(entry.date)

          return normalizedEntryDate >= normalizedStartDate && normalizedEntryDate <= normalizedEndDate
        })
      }

      if (workerId) {
        entries = entries.filter((entry) => entry.workerId === workerId)
      }

      return entries.sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateB.getTime() - dateA.getTime()
      })
    }
    return []
  }

  // Get time entries grouped by month
  static async getTimeEntriesGroupedByMonth(workerId?: string): Promise<{ [key: string]: TimeEntry[] }> {
    const entries = await this.getTimeEntries(undefined, undefined, workerId)
    const grouped: { [key: string]: TimeEntry[] } = {}

    entries.forEach((entry) => {
      const date = new Date(entry.date)
      const monthKey = `${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`

      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(entry)
    })

    const sortedGrouped: { [key: string]: TimeEntry[] } = {}
    Object.keys(grouped)
      .sort((a, b) => {
        const [monthA, yearA] = a.split(".").map(Number)
        const [monthB, yearB] = b.split(".").map(Number)
        return yearB - yearA || monthB - monthA
      })
      .forEach((key) => {
        sortedGrouped[key] = grouped[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      })

    return sortedGrouped
  }

  // Get auto-close settings
  static async getAutoCloseSettings(): Promise<{ time: string; enabled: boolean }> {
    const settingsRef = ref(database, "settings/autoClose")
    const snapshot = await get(settingsRef)

    if (snapshot.exists()) {
      return snapshot.val()
    }
    return { time: "18:00", enabled: true }
  }

  // Update auto-close settings
  static async updateAutoCloseSettings(time: string, enabled: boolean): Promise<void> {
    const settingsRef = ref(database, "settings/autoClose")
    await set(settingsRef, { time, enabled })
  }

  // Enhanced auto-close sessions with configurable time
  static async autoCloseSessions(customCloseTime?: string): Promise<{ closed: number; message: string }> {
    const sessionsRef = ref(database, "activeSessions")
    const snapshot = await get(sessionsRef)

    if (!snapshot.exists()) {
      return { closed: 0, message: "Nessuna sessione attiva da chiudere" }
    }

    const settings = await this.getAutoCloseSettings()
    const closeTime = customCloseTime || settings.time

    if (!settings.enabled && !customCloseTime) {
      return { closed: 0, message: "Chiusura automatica disabilitata" }
    }

    const sessionsData = snapshot.val()
    const milanNow = this.getMilanTime()
    const today = this.formatMilanDate(milanNow)

    const currentHour = milanNow.getHours()
    const currentMinute = milanNow.getMinutes()
    const currentTimeMinutes = currentHour * 60 + currentMinute

    const [closeHour, closeMinute] = closeTime.split(":").map(Number)
    const closeTimeMinutes = closeHour * 60 + closeMinute

    let closedCount = 0

    console.log(
      `Auto-close check: Current time ${currentHour}:${currentMinute.toString().padStart(2, "0")} (${currentTimeMinutes} min), Close time ${closeTime} (${closeTimeMinutes} min)`,
    )

    for (const sessionId of Object.keys(sessionsData)) {
      const session = sessionsData[sessionId]
      let shouldClose = false
      let actualCloseTime = closeTime + ":00"

      if (session.date < today) {
        // Session from previous day - close it
        shouldClose = true
        console.log(`Closing session from previous day: ${session.workerName} - ${session.date}`)
      } else if (session.date === today && currentTimeMinutes >= closeTimeMinutes) {
        // Session from today and past closing time
        shouldClose = true
        actualCloseTime = this.formatMilanTime(milanNow)
        console.log(
          `Closing session from today past closing time: ${session.workerName} - current: ${currentTimeMinutes}, close: ${closeTimeMinutes}`,
        )
      }

      if (shouldClose) {
        const checkInTime = new Date(`${session.date}T${session.checkIn}`)
        const autoCheckOut = new Date(`${session.date}T${actualCloseTime}`)

        if (autoCheckOut <= checkInTime) {
          autoCheckOut.setDate(autoCheckOut.getDate() + 1)
        }

        const hoursWorked = (autoCheckOut.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

        const entriesRef = ref(database, "timeEntries")
        const newEntryRef = push(entriesRef)
        await set(newEntryRef, {
          workerId: session.workerId,
          workerName: session.workerName,
          checkIn: session.checkIn,
          checkOut: actualCloseTime,
          date: session.date,
          hoursWorked: Math.max(0, Math.round(hoursWorked * 100) / 100),
          isAutoClose: true,
          isManualEntry: false,
          notes: `Chiusura automatica alle ${closeTime}`,
        })

        const sessionRef = ref(database, `activeSessions/${sessionId}`)
        await set(sessionRef, null)
        closedCount++

        console.log(`Session closed: ${session.workerName} - ${session.checkIn} to ${actualCloseTime}`)
      }
    }

    const resultMessage =
      closedCount > 0
        ? `${closedCount} sessioni chiuse automaticamente alle ${closeTime}`
        : `Nessuna sessione da chiudere (ora attuale: ${currentHour}:${currentMinute.toString().padStart(2, "0")}, chiusura: ${closeTime})`

    console.log(`Auto-close result: ${resultMessage}`)

    return {
      closed: closedCount,
      message: resultMessage,
    }
  }

  // Manual close all active sessions (admin function)
  static async forceCloseAllSessions(closeTime?: string): Promise<{ closed: number; message: string }> {
    const sessionsRef = ref(database, "activeSessions")
    const snapshot = await get(sessionsRef)

    if (!snapshot.exists()) {
      return { closed: 0, message: "Nessuna sessione attiva" }
    }

    const sessionsData = snapshot.val()
    const now = this.getMilanTime()
    const actualCloseTime = closeTime || this.formatMilanTime(now)
    let closedCount = 0

    for (const sessionId of Object.keys(sessionsData)) {
      const session = sessionsData[sessionId]

      const checkInTime = new Date(`${session.date}T${session.checkIn}`)
      const forceCloseTime = new Date(`${session.date}T${actualCloseTime}`)

      if (forceCloseTime <= checkInTime) {
        forceCloseTime.setDate(forceCloseTime.getDate() + 1)
      }

      const hoursWorked = (forceCloseTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      const entriesRef = ref(database, "timeEntries")
      const newEntryRef = push(entriesRef)
      await set(newEntryRef, {
        workerId: session.workerId,
        workerName: session.workerName,
        checkIn: session.checkIn,
        checkOut: actualCloseTime,
        date: session.date,
        hoursWorked: Math.max(0, Math.round(hoursWorked * 100) / 100),
        isAutoClose: false,
        isManualEntry: false,
        notes: "Chiusura forzata dall'admin",
      })

      const sessionRef = ref(database, `activeSessions/${sessionId}`)
      await set(sessionRef, null)
      closedCount++
    }

    return {
      closed: closedCount,
      message: `${closedCount} sessioni chiuse manualmente`,
    }
  }

  static onWorkersChange(callback: (workers: Worker[]) => void): () => void {
    const workersRef = ref(database, "workers")

    const unsubscribe = onValue(workersRef, (snapshot) => {
      if (snapshot.exists()) {
        const workersData = snapshot.val()
        const workers = Object.keys(workersData).map((key) => ({
          id: key,
          ...workersData[key],
        }))
        callback(workers)
      } else {
        callback([])
      }
    })

    return () => off(workersRef, "value", unsubscribe)
  }

  static onActiveSessionsChange(callback: (sessions: WorkSession[]) => void): () => void {
    const sessionsRef = ref(database, "activeSessions")

    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionsData = snapshot.val()
        const sessions = Object.values(sessionsData) as WorkSession[]
        callback(sessions)
      } else {
        callback([])
      }
    })

    return () => off(sessionsRef, "value", unsubscribe)
  }
}
