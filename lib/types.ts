export interface Worker {
  id: string
  name: string
  imageUrl: string
}

export interface TimeEntry {
  id: string
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
