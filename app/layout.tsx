import type React from "react"
import type { Metadata } from "next"
import { League_Spartan } from "next/font/google"
import "./globals.css"

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-league-spartan",
})

export const metadata: Metadata = {
  title: "VMH Tracker - Sistema di Gestione Presenze",
  description: "Sistema di tracciamento presenze per lavoratori con riconoscimento facciale",
  generator: "v0.dev",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VMH Tracker",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" className={leagueSpartan.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VMH Tracker" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
