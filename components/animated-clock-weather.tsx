"use client"

import { useState, useEffect } from "react"
import { Clock, Cloud, Sun, CloudRain, CloudSnow } from "lucide-react"

interface WeatherData {
  temperature: number
  description: string
  icon: string
}

export function AnimatedClockWeather() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Fetch weather data for Milan
    fetchWeather()

    return () => clearInterval(timeInterval)
  }, [])

  const fetchWeather = async () => {
    try {
      const response = await fetch(`https://wttr.in/Milan?format=j1`)

      if (response.ok) {
        const data = await response.json()
        const current = data.current_condition[0]
        setWeather({
          temperature: Number.parseInt(current.temp_C),
          description: current.weatherDesc[0].value.toLowerCase(),
          icon: getWeatherType(current.weatherCode),
        })
      } else {
        // Fallback weather data for Milan
        setWeather({
          temperature: 18,
          description: "parzialmente nuvoloso",
          icon: "Clouds",
        })
      }
    } catch (error) {
      console.error("Error fetching weather:", error)
      setWeather({
        temperature: 18,
        description: "parzialmente nuvoloso",
        icon: "Clouds",
      })
    } finally {
      setLoading(false)
    }
  }

  const getWeatherType = (weatherCode: string) => {
    const code = Number.parseInt(weatherCode)
    if (code >= 200 && code < 300) return "Rain" // Thunderstorm
    if (code >= 300 && code < 400) return "Rain" // Drizzle
    if (code >= 500 && code < 600) return "Rain" // Rain
    if (code >= 600 && code < 700) return "Snow" // Snow
    if (code >= 700 && code < 800) return "Clouds" // Atmosphere
    if (code === 800) return "Clear" // Clear
    if (code > 800) return "Clouds" // Clouds
    return "Clear"
  }

  const getWeatherIcon = (iconType: string) => {
    switch (iconType) {
      case "Clear":
        return <Sun className="h-5 w-5 text-yellow-500" />
      case "Clouds":
        return <Cloud className="h-5 w-5 text-gray-500" />
      case "Rain":
        return <CloudRain className="h-5 w-5 text-blue-500" />
      case "Snow":
        return <CloudSnow className="h-5 w-5 text-blue-300" />
      default:
        return <Sun className="h-5 w-5 text-yellow-500" />
    }
  }

  const getDayProgress = () => {
    const now = new Date()
    const milanTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }))
    const startOfDay = new Date(milanTime.getFullYear(), milanTime.getMonth(), milanTime.getDate())
    const endOfDay = new Date(milanTime.getFullYear(), milanTime.getMonth(), milanTime.getDate() + 1)
    const totalMinutes = (endOfDay.getTime() - startOfDay.getTime()) / (1000 * 60)
    const elapsedMinutes = (milanTime.getTime() - startOfDay.getTime()) / (1000 * 60)
    return (elapsedMinutes / totalMinutes) * 100
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const dayProgress = getDayProgress()

  return (
    <div className="flex items-center justify-center space-x-8">
      {/* Clock Section */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Clock className="h-8 w-8 text-blue-600 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 font-mono tracking-wider">{formatTime(currentTime)}</div>
          <div className="text-sm text-gray-600">{formatDate(currentTime)}</div>
        </div>
      </div>

      {/* Day Progress Bar */}
      <div className="flex flex-col items-center space-y-2">
        <div className="text-sm font-bold text-gray-700">Progresso Giornata</div>
        <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${dayProgress}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 font-bold">{dayProgress.toFixed(1)}% completato</div>
      </div>

      {/* Weather Section */}
      <div className="flex items-center space-x-3">
        {loading ? (
          <div className="flex items-center space-x-2">
            <Cloud className="h-6 w-6 text-gray-400 animate-pulse" />
            <div className="text-sm text-gray-500">Caricamento...</div>
          </div>
        ) : weather ? (
          <div className="flex items-center space-x-3">
            {getWeatherIcon(weather.icon)}
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{weather.temperature}°C</div>
              <div className="text-xs text-gray-600 capitalize">Milano - {weather.description}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
