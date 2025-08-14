export interface Worker {
  id: string
  name: string
  imageUrl: string
  hourlyRate?: number // Added hourlyRate field for worker pay calculation
}

export interface TimeEntry {
  id?: string // Made id optional for new entries
  workerId: string
  workerName: string
  checkIn: string
  checkOut?: string
  date: string
  hoursWorked?: number
  isAutoClose?: boolean // True if checkout was done automatically
  isManualEntry?: boolean // True if entry was added manually by admin
  notes?: string // Additional notes for the entry
}

export interface WorkSession {
  workerId: string
  workerName: string
  checkIn: string
  date: string
}
