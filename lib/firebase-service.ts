import { database } from "./firebase"
import { ref, get, set, push, remove } from "firebase/database"
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
  static async addWorker(name: string, imageUrl: string): Promise<void> {
    const workersRef = ref(database, "workers")
    const newWorkerRef = push(workersRef)
    await set(newWorkerRef, {
      name,
      imageUrl: imageUrl || "",
    })
  }

  // Update worker
  static async updateWorker(workerId: string, name: string, imageUrl: string): Promise<void> {
    const workerRef = ref(database, `workers/${workerId}`)
    await set(workerRef, {
      name,
      imageUrl: imageUrl || "",
    })
  }

  // Delete worker
  static async deleteWorker(workerId: string): Promise<void> {
    const workerRef = ref(database, `workers/${workerId}`)
    await remove(workerRef)
  }

  // Check in worker
  static async checkInWorker(worker: Worker): Promise<void> {
    const now = new Date()
    const dateStr = now.toISOString().split("T")[0]
    const timeStr = now.toLocaleTimeString("it-IT", { hour12: false })

    const sessionRef = ref(database, `activeSessions/${worker.id}`)
    await set(sessionRef, {
      workerId: worker.id,
      workerName: worker.name,
      checkIn: timeStr,
      date: dateStr,
    })
  }

  // Check out worker
  static async checkOutWorker(workerId: string): Promise<void> {
    const sessionRef = ref(database, `activeSessions/${workerId}`)
    const snapshot = await get(sessionRef)

    if (snapshot.exists()) {
      const session = snapshot.val()
      const now = new Date()
      const checkOutTime = now.toLocaleTimeString("it-IT", { hour12: false })

      // Calculate hours worked
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
      })

      // Remove from active sessions
      await set(sessionRef, null)
    }
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

  // Get time entries for reporting
  static async getTimeEntries(startDate?: string, endDate?: string, workerId?: string): Promise<TimeEntry[]> {
    const entriesRef = ref(database, "timeEntries")
    const snapshot = await get(entriesRef)

    if (snapshot.exists()) {
      const entriesData = snapshot.val()
      let entries = Object.keys(entriesData).map((key) => ({
        id: key,
        ...entriesData[key],
      }))

      // Filter by date range
      if (startDate && endDate) {
        entries = entries.filter((entry) => entry.date >= startDate && entry.date <= endDate)
      }

      // Filter by worker
      if (workerId) {
        entries = entries.filter((entry) => entry.workerId === workerId)
      }

      return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return []
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

    // Get auto-close settings
    const settings = await this.getAutoCloseSettings()
    const closeTime = customCloseTime || settings.time

    if (!settings.enabled && !customCloseTime) {
      return { closed: 0, message: "Chiusura automatica disabilitata" }
    }

    const sessionsData = snapshot.val()
    const today = new Date().toISOString().split("T")[0]
    const now = new Date()
    const currentTime = now.toLocaleTimeString("it-IT", { hour12: false }).substring(0, 5)

    let closedCount = 0

    for (const sessionId of Object.keys(sessionsData)) {
      const session = sessionsData[sessionId]
      let shouldClose = false
      let actualCloseTime = closeTime + ":00"

      // Close sessions from previous days at specified time
      if (session.date < today) {
        shouldClose = true
      }
      // Close sessions from today if current time is past close time
      else if (session.date === today && currentTime >= closeTime) {
        shouldClose = true
        actualCloseTime = currentTime + ":00"
      }

      if (shouldClose) {
        const checkInTime = new Date(`${session.date}T${session.checkIn}`)
        const autoCheckOut = new Date(`${session.date}T${actualCloseTime}`)

        // Ensure checkout is not before checkin
        if (autoCheckOut <= checkInTime) {
          autoCheckOut.setDate(autoCheckOut.getDate() + 1)
        }

        const hoursWorked = (autoCheckOut.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

        // Save to time entries with auto checkout
        const entriesRef = ref(database, "timeEntries")
        const newEntryRef = push(entriesRef)
        await set(newEntryRef, {
          workerId: session.workerId,
          workerName: session.workerName,
          checkIn: session.checkIn,
          checkOut: actualCloseTime,
          date: session.date,
          hoursWorked: Math.max(0, Math.round(hoursWorked * 100) / 100),
          autoClose: true,
          autoCloseTime: closeTime,
        })

        // Remove from active sessions
        const sessionRef = ref(database, `activeSessions/${sessionId}`)
        await set(sessionRef, null)
        closedCount++
      }
    }

    return {
      closed: closedCount,
      message:
        closedCount > 0
          ? `${closedCount} sessioni chiuse automaticamente alle ${closeTime}`
          : "Nessuna sessione da chiudere",
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
    const now = new Date()
    const actualCloseTime = closeTime || now.toLocaleTimeString("it-IT", { hour12: false })
    let closedCount = 0

    for (const sessionId of Object.keys(sessionsData)) {
      const session = sessionsData[sessionId]

      const checkInTime = new Date(`${session.date}T${session.checkIn}`)
      const forceCloseTime = new Date(`${session.date}T${actualCloseTime}`)

      // If force close time is before check in, assume next day
      if (forceCloseTime <= checkInTime) {
        forceCloseTime.setDate(forceCloseTime.getDate() + 1)
      }

      const hoursWorked = (forceCloseTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      // Save to time entries
      const entriesRef = ref(database, "timeEntries")
      const newEntryRef = push(entriesRef)
      await set(newEntryRef, {
        workerId: session.workerId,
        workerName: session.workerName,
        checkIn: session.checkIn,
        checkOut: actualCloseTime,
        date: session.date,
        hoursWorked: Math.max(0, Math.round(hoursWorked * 100) / 100),
        manualClose: true,
      })

      // Remove from active sessions
      const sessionRef = ref(database, `activeSessions/${sessionId}`)
      await set(sessionRef, null)
      closedCount++
    }

    return {
      closed: closedCount,
      message: `${closedCount} sessioni chiuse manualmente`,
    }
  }
}
