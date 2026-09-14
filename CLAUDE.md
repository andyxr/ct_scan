# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This is a Next.js application for analyzing CSV files containing development team cycle time data. Users can upload CSV files and generate various analyses including cycle time scatterplots, correlation analysis, and process behaviour charts.

## Commands

- `npm run dev` - Start development server (usually on localhost:3000, may use 3001/3002 if port is busy)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Tech Stack
- **Next.js 15** with App Router and React 18
- **TypeScript** with strict mode enabled
- **Tailwind CSS 4** with PostCSS
- **Papaparse** for client-side CSV parsing
- **Recharts 3.2** for data visualization (ScatterChart, LineChart, BarChart)
- **Lucide React** for icon components

## Rules
During prompt sessions, be extremely concise. Sacrifice grammar for the sake of concision.
The source code is the souce of truth. Markdown and HTML files that are stored in ./notes and/or ./docs folders are for the user's benefit only, not the coding agent's.
