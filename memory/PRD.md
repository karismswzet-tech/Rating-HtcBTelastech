# PRD — Copper Strip Corrosion Rating Analyzer

## Original problem statement (verbatim)
Build a full-stack web application: Copper Strip Corrosion Rating Analyzer per ASTM D130 / IP 154 with database storage. Features: upload+analyze photo (AI vision determines rating 1a-4c), show large bold rating + tarnish category (Slight/Moderate/Dark/Corrosion) + description + permanent ASTM reference grid. Save each analysis (image, timestamp, rating, category, notes, sample ID). History page with search by date/rating, detail view, delete. Export PDF (single) and CSV/Excel (history). Responsive clean lab-themed UI, technician-friendly.

## User personas
- Laboratory technician running copper strip corrosion tests, needs quick classification + traceable record with export.

## Architecture
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations LlmChat (OpenAI GPT-5.2 vision) + reportlab (PDF) + csv module.
- Frontend: React 19 + react-router-dom v7 + Tailwind + shadcn/ui (Card, Button, Input, Textarea, Table, Dialog, AlertDialog, Select, Sonner toasts) + lucide-react icons.
- MongoDB collection: `analyses` — {id, created_at, rating, category, description, confidence, sample_name, notes, image_data (data URL)}.

## User choices (defaults applied)
- AI model: OpenAI GPT-5.2 (vision).
- Key: EMERGENT_LLM_KEY.
- Auth: none (single-lab internal tool).
- Database: MongoDB.
- Exports: PDF + CSV included from day 1.

## Implemented (2026-02)
- POST /api/analyze — sends base64 image to GPT-5.2 vision; parses strict JSON; stores in Mongo; returns full record.
- GET /api/analyses — list with filters (rating, date_from, date_to, q).
- GET /api/analyses/{id} — detail (includes image_data).
- PATCH /api/analyses/{id} — update sample_name/notes.
- DELETE /api/analyses/{id}.
- GET /api/analyses/{id}/pdf — reportlab PDF export with image and metadata.
- GET /api/analyses/export/csv — CSV of full history.
- GET /api/astm/reference — 12 ASTM reference swatches.
- Frontend: Analyzer page (drag-drop upload, resize to <=1600px, sample id, notes, animated result card with giant rating), History page (stat cards per category, filters, table, view detail dialog, delete confirm, CSV export), permanent ASTM reference grid.

## Prioritized backlog (P0/P1/P2 remaining)
- P1: Analysis edit (edit sample_name/notes from detail dialog).
- P1: Batch delete / bulk operations.
- P1: Direct camera capture on mobile (input capture=environment).
- P2: Optional simple login / multi-user isolation.
- P2: Charts / trend over time (recharts).
- P2: Print-friendly certificate template with lab letterhead.

## Next tasks
1. Confirm rating accuracy on real sample photos.
2. Add optional bulk export of PDFs (zip).
3. Add small onboarding tooltip on the ASTM reference card.
