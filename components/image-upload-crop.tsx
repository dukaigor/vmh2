"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Upload, RotateCw, ZoomIn } from "lucide-react"
import { Slider } from "@/components/ui/slider"

interface ImageUploadCropProps {
  currentImageUrl?: string
  onImageSave: (imageUrl: string) => void
  isOpen: boolean
  onClose: () => void
  workerName?: string
}

export function ImageUploadCrop({ currentImageUrl, onImageSave, isOpen, onClose, workerName }: ImageUploadCropProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>(currentImageUrl || "")
  const [isUploading, setIsUploading] = useState(false)
  const [cropSettings, setCropSettings] = useState({
    scale: 1,
    rotation: 0,
    x: 0,
    y: 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setImageUrl(url)
      setCropSettings({ scale: 1, rotation: 0, x: 0, y: 0 })
    }
  }

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - cropSettings.x, y: e.clientY - cropSettings.y })
  }

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setCropSettings((prev) => ({
          ...prev,
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        }))
      }
    },
    [isDragging, dragStart],
  )

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const uploadToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const { url } = await response.json()
    return url
  }

  const getCroppedImage = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      const img = imageRef.current!

      // Set canvas size to desired output (200x200 for circular profile)
      canvas.width = 200
      canvas.height = 200

      // Clear canvas
      ctx.clearRect(0, 0, 200, 200)

      // Save context
      ctx.save()

      // Move to center for rotation
      ctx.translate(100, 100)
      ctx.rotate((cropSettings.rotation * Math.PI) / 180)
      ctx.scale(cropSettings.scale, cropSettings.scale)

      // Draw image centered
      const size = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth - size) / 2 + cropSettings.x / cropSettings.scale
      const sy = (img.naturalHeight - size) / 2 + cropSettings.y / cropSettings.scale

      ctx.drawImage(img, sx, sy, size, size, -100, -100, 200, 200)

      // Restore context
      ctx.restore()

      canvas.toBlob(resolve!, "image/jpeg", 0.9)
    })
  }

  const handleSave = async () => {
    if (!imageUrl) return

    setIsUploading(true)
    try {
      let finalImageUrl = imageUrl

      if (selectedFile) {
        // Get cropped image
        const croppedBlob = await getCroppedImage()
        const croppedFile = new File([croppedBlob], `${workerName || "worker"}-photo.jpg`, {
          type: "image/jpeg",
        })

        // Upload to Blob storage
        finalImageUrl = await uploadToBlob(croppedFile)
      }

      onImageSave(finalImageUrl)
      onClose()
    } catch (error) {
      console.error("Error saving image:", error)
      alert("Errore nel salvare l'immagine")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{currentImageUrl ? "Modifica Foto Lavoratore" : "Carica Foto Lavoratore"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Seleziona Foto
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>

          {/* Image Preview and Crop Controls */}
          {imageUrl && (
            <div className="space-y-4">
              {/* Preview Area */}
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div
                  className="relative w-80 h-80 mx-auto bg-gray-100 rounded-lg overflow-hidden cursor-move"
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl || "/placeholder.svg"}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      transform: `translate(${cropSettings.x}px, ${cropSettings.y}px) scale(${cropSettings.scale}) rotate(${cropSettings.rotation}deg)`,
                      transformOrigin: "center",
                    }}
                    draggable={false}
                  />
                  {/* Crop Circle Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black bg-opacity-50"></div>
                    <div
                      className="absolute top-1/2 left-1/2 w-48 h-48 border-4 border-white rounded-full"
                      style={{ transform: "translate(-50%, -50%)" }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Crop Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ZoomIn className="w-4 h-4" />
                    Zoom: {cropSettings.scale.toFixed(1)}x
                  </label>
                  <Slider
                    value={[cropSettings.scale]}
                    onValueChange={([value]) => setCropSettings((prev) => ({ ...prev, scale: value }))}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <RotateCw className="w-4 h-4" />
                    Rotazione: {cropSettings.rotation}°
                  </label>
                  <Slider
                    value={[cropSettings.rotation]}
                    onValueChange={([value]) => setCropSettings((prev) => ({ ...prev, rotation: value }))}
                    min={-180}
                    max={180}
                    step={15}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Reset Button */}
              <Button
                onClick={() => setCropSettings({ scale: 1, rotation: 0, x: 0, y: 0 })}
                variant="outline"
                className="w-full"
              >
                Reset Posizione
              </Button>

              {/* Hidden Canvas for Processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} variant="outline">
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={!imageUrl || isUploading} className="flex items-center gap-2">
              {isUploading ? "Salvando..." : "Salva Foto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
