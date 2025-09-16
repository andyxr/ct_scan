# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This is a Next.js application for analyzing CSV files containing development team cycle time data.

## Commands

- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Tech Stack
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Papaparse for CSV parsing
- Recharts for data visualization

### Application Flow
1. User uploads CSV file via drag-and-drop or file picker
2. CSV is parsed client-side using Papaparse
3. User selects analysis type (currently only Cycle Time Analysis is implemented)
4. Analysis component processes data and displays visualization

### Key Components
- `app/page.tsx` - Main application orchestrator, manages state flow
- `components/FileUpload.tsx` - CSV upload with drag-and-drop support
- `components/ActionSelector.tsx` - Analysis type selection interface
- `components/CycleTimeAnalysis.tsx` - Scatter plot with 85th percentile calculation

### Data Processing
The CycleTimeAnalysis component automatically detects CSV columns for:
- End dates (looks for columns containing "end date", "completed", "done date")
- Cycle times (looks for columns containing "cycle time", "lead time", "duration")
- Item names (looks for columns containing "title", "name", "item", "task", "issue")

## Future Features
- Process Behaviour Chart - For visualizing process stability
- Monte Carlo Simulation - For delivery forecasting