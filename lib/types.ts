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
}

export interface WorkSession {
  workerId: string
  workerName: string
  checkIn: string
  date: string
}
