'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'

interface FileUploadProps {
  onUpload: (data: any[]) => void
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    Papa.parse(file, {
      header: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError('Error parsing CSV file')
          console.error(result.errors)
        } else {
          setError(null)
          onUpload(result.data)
        }
      },
      error: (error) => {
        setError('Error reading file')
        console.error(error)
      }
    })
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  return (
    <div className="flex justify-center">
      <div
        className={`w-80 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <svg
          className="mx-auto h-8 w-8 text-gray-400 mb-3"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <label htmlFor="file-upload" className="cursor-pointer">
          <span className="text-base font-medium text-gray-900">
            Drop CSV file here
          </span>
          <p className="text-sm text-gray-600 mt-1">or click to browse</p>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept=".csv"
            onChange={handleFileInput}
          />
        </label>

        {error && (
          <div className="mt-4 text-red-600 text-sm">{error}</div>
        )}
      </div>
    </div>
  )
}