# RxPulse - Medical Benefit Drug Policy Tracker

> Built for **Anton Rx Innovation Hacks 2.0** | April 3-5, 2026 | Arizona State University

RxPulse is an AI-powered system that ingests, parses, and normalizes medical policy documents from multiple health plans to create a searchable, comparable view of medical benefit drug coverage across payers.

## The Problem

Health plans govern coverage of provider-administered drugs (infusions, injectables, biologics) through individual medical policies that vary by payer and change frequently. There is no centralized source for tracking which drugs are covered, what clinical criteria apply, or how policies differ across plans. Today, analysts read policy PDFs one at a time -- slow, expensive, and error-prone.

## What RxPulse Does

Upload a medical policy PDF and RxPulse will:

1. **Parse** the document using page-level section detection (coverage, indications, coding, references)
2. **Extract** structured data via Google Gemini: drug names, HCPCS codes, covered indications, prior auth criteria, step therapy requirements, site-of-care restrictions
3. **Normalize** across payers into a common schema for apples-to-apples comparison
4. **Detect changes** automatically when a new version of the same policy is uploaded
5. **Answer questions** about policies using RAG-powered AI assistant

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)              Data
---------------------           ----------------              ----
Dashboard                       /api/v1/upload         -->    Supabase (PostgreSQL)
Policy Search                   /api/v1/stats                  - plans
Coverage Matrix                 /api/v1/search/policy          - documents
Coverage Pathway                /api/v1/compare/plans          - drug_coverages
Reports                         /api/v1/qa/ask                 - document_chunks
AI Assistant                    /api/v1/policy-changes         - policy_changes

                                Services:
                                - pdf_policy_parser.py    (PDF parsing + section detection)
                                - policy_pipeline.py      (orchestration)
                                - gemini.py               (Gemini API for extraction + RAG)
                                - upload_jobs.py          (background job queue)
                                - supabase.py             (database operations)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router v7, Recharts |
| Backend | Python 3.11, FastAPI, pdfplumber |
| AI | Google Gemini (Flash) for extraction + RAG Q&A |
| Database | Supabase (PostgreSQL) |
| PDF Processing | pdfplumber + custom section classifier |

## Key Features

### Data Ingestion Pipeline
- **Smart PDF parsing**: Page-level section detection classifies content as coverage, indications, coding, references, or revision history
- **Scope-aware extraction**: Gemini receives policy metadata (payer, document type, governed drugs) so it only extracts relevant drugs -- not prerequisite therapies or literature references
- **Drug name canonicalization**: Maps biosimilar brand names to generic families (e.g., Mvasi, Zirabev, Alymsys all map to bevacizumab)
- **Background processing**: Large PDFs are processed asynchronously via a job queue -- the API returns immediately

### Coverage Intelligence
- **Cross-payer search**: "Which payers cover rituximab?" returns structured coverage data from all ingested policies
- **Side-by-side comparison**: Compare PA criteria, step therapy, site-of-care restrictions across payers for any drug
- **Coverage pathway**: Visual step-by-step flowchart showing exactly what's needed for approval (payer-first, then drug)
- **Coverage matrix**: Drug-vs-payer heatmap showing coverage status at a glance

### Change Detection
- **Auto-versioning**: When the same payer + policy number is uploaded again, RxPulse detects it as a new version
- **Auto-diff**: Runs Gemini comparison between old and new versions, stores changes as queryable records
- **Change feed**: Filterable timeline of policy changes across all payers

### AI Assistant
- **RAG-based Q&A**: Questions are answered using actual policy text chunks retrieved from the database -- not hallucinated
- **Chat persistence**: Conversation survives page refreshes via localStorage
- **Source attribution**: Every answer cites which payer's policy data was used

## Sample Questions the System Answers

- "Which health plans cover bevacizumab under their medical benefit?"
- "What prior authorization criteria does Cigna require for rituximab?"
- "How does bevacizumab coverage differ between Florida Blue and Blue Cross NC?"
- "Does Blue Cross NC require step therapy for trastuzumab biosimilars?"

## Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project (free tier works)
- Google Gemini API key

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Mac/Linux
# venv\Scripts\activate       # Windows

pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Fill in: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY

# Run database migrations (in Supabase SQL Editor)
# See db/001_initial_schema.sql, db/002_drug_coverages.sql, db/003_versioning_and_changes.sql

# Start server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

### Loading Policy Data

```bash
cd backend
python preload.py "/path/to/policy1.pdf" "/path/to/policy2.pdf"
```

The preload script runs the full pipeline: parse PDF, detect payer, extract coverages, save chunks for RAG, and auto-detect version changes.

## Project Structure

```
rxpulse/
  backend/
    app/
      api/routes.py              # All API endpoints
      config.py                  # Environment config
      schemas/                   # Pydantic models
      services/
        gemini.py                # Gemini API: extraction, RAG, diff
        pdf_policy_parser.py     # PDF parsing + section classification
        policy_pipeline.py       # Orchestrates parse -> extract -> chunk
        supabase.py              # Database operations
        upload_jobs.py           # Background job queue
    db/                          # SQL migrations
    preload.py                   # CLI tool to ingest PDFs
  frontend/
    src/
      pages/
        DashboardView.jsx        # Stats, upload, top drugs
        PathwayView.jsx          # Coverage pathway flowchart
        HeatmapView.jsx          # Coverage matrix
        ReportView.jsx           # AI-generated comparison reports
      components/
        Search/DrugSearch.jsx    # Policy search with cards
        Map/CoverageMap.jsx      # Policy changes feed
        QA/ChatInterface.jsx     # AI assistant chat
      App.jsx                    # Routing + navigation
```

## Tested With

| Payer | Document | Pages | Drugs Extracted |
|-------|----------|-------|-----------------|
| Blue Cross NC | Preferred Injectable Oncology Program | 26 | 20 |
| Florida Blue | Bevacizumab MCG Policy | 15 | 7 |
| Cigna | Rituximab IV for Non-Oncology Indications | 32 | 4 |

## Team

Built by Akhil and Vaishnavi for Anton Rx Innovation Hacks 2.0.
