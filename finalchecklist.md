# HouseGuide – Client Dashboard Expansion Final Checklist

## Current State Assessment
- [x] Client dashboard loads properly
- [x] Scan Image opens upload (OCR not wired)
- [x] Open Note does nothing (needs implementation)
- [x] Manage Status works
- [x] View Trackers navigates
- [x] Generate Report supports manual text only
- [x] Trackers: only Checklist persists; others accept input but don't save

## Goals Implementation

### Sidebar / Folder Structure (shadcn-style) ✅ COMPLETED
- [x] Add collapsible sidebar (left) on Client Dashboard with folders
- [x] Create Weekly Reports folder
- [x] Create Pictures folder
- [x] Create Notes folder (include OCR text from scanned images)
- [x] Create Trackers folder with subfolders:
  - [x] Goals
  - [x] Checklist
  - [x] Chores
  - [x] Accomplishments
  - [x] Incidents
  - [x] Meetings
  - [x] Fees
- [ ] Each folder lists entries (title + timestamp)
- [ ] Click to view functionality for each entry

### Persist ALL Trackers
- [x] Mirror Checklist's persistence for Goals
- [x] Mirror Checklist's persistence for Chores
- [x] Mirror Checklist's persistence for Accomplishments
- [x] Mirror Checklist's persistence for Incidents
- [x] Mirror Checklist's persistence for Meetings
- [x] Mirror Checklist's persistence for Fees
- [x] On save, create record with metadata: { id, residentId, houseId, createdBy, createdAt, data }

### Notes & OCR ✅ COMPLETED
- [x] Open Note → create/save note in Notes
- [x] Scan Image functionality:
  - [x] Upload image to storage
  - [x] Run OCR (async)
  - [x] Save image in Pictures
  - [x] Save extracted text as linked Note in Notes (link back to image)

### Weekly Report (Template + AI Rewrite)
- [ ] Keep manual entry functionality
- [ ] Add Generate Weekly Report (AI) feature
- [ ] Backend collects week data (trackers, notes, incidents, meetings, fees, OCR text)
- [ ] Use existing Weekly Report template strictly—no freestyle
- [ ] Empty sections → "No updates this week"
- [ ] Save AI output in Weekly Reports
- [ ] Allow editing before final save
- [ ] AI provider (env-switchable):
  - [ ] Default: GPT4All (local)
  - [ ] Support Ollama (e.g., llama3.1:8b-instruct)
  - [ ] Support OpenAI as optional provider
  - [ ] AI_PROVIDER=gpt4all|ollama|openai environment variable

### Voice-to-Text
- [ ] Mic button beside major textareas (Notes, Reports, Trackers)
- [ ] Desktop: Web Speech API implementation
- [ ] Mobile: native keyboard dictation
- [ ] Graceful fallback for unsupported browsers

## Implementation Details

### Frontend Components
- [x] Create client/src/components/ResidentSidebar.tsx (shadcn/ui, collapsible)
- [x] Create client/src/pages/ResidentDashboard.tsx (wraps House/Resident views with sidebar)
- [ ] Create client/src/components/ReportEditor.tsx (markdown/textarea + "Generate with AI" + "Save")
- [ ] Create client/src/components/MicInput.tsx (Web Speech API hook + button)
- [ ] Update client/src/lib/api.ts (add new API helpers)

### Backend Implementation
- [ ] Update server/routes.ts (new endpoints)
- [ ] Create server/ai/index.ts (provider router)
- [ ] Create server/ai/providers/gpt4all.ts
- [ ] Create server/ai/providers/ollama.ts
- [ ] Create server/ai/providers/openai.ts
- [ ] Create server/templates/weeklyReport.md (use existing template file—read from disk)
- [ ] Create server/jobs/ocrWorker.ts (queue processors)
- [ ] Create server/jobs/aiWorker.ts (queue processors)

## API Contracts

### Weekly Reports
- [x] POST /api/reports/weekly/generate - Body: { residentId, weekStart, weekEnd } Returns: { draft: string }
- [x] POST /api/reports/weekly - Body: { residentId, weekStart, weekEnd, title, body } → creates report
- [x] GET /api/reports/weekly/by-resident/:residentId?from=&to=

### Backend Infrastructure ✅ COMPLETED
- [x] Weekly Reports API system fully implemented
- [x] Multi-tenant support (houseId + createdBy) added to all tracker endpoints
- [x] Storage layer enhanced with weekly reports support
- [x] Database and memory storage implementations complete
- [x] Server running successfully with no errors

### Notes & Pictures
- [ ] POST /api/notes → { residentId, text, source: 'manual'|'ocr', imageId? }
- [ ] POST /api/files/upload (multipart) → returns { fileId, url } and enqueues OCR
- [ ] GET /api/files/by-resident/:residentId
- [ ] GET /api/notes/by-resident/:residentId

### Trackers (mirror checklist)
- [ ] POST /api/goals → create
- [ ] POST /api/chores → create
- [ ] POST /api/accomplishments → create
- [ ] POST /api/incidents → create
- [ ] POST /api/meetings → create
- [ ] POST /api/fees → create
- [ ] GET /api/{goals|chores|accomplishments|incidents|meetings|fees}/by-resident/:residentId → list
- [ ] PATCH /api/{goals|chores|accomplishments|incidents|meetings|fees}/:id → update

## DB Models / Migrations
- [x] weekly_reports: id, residentId, houseId, title, body, weekStart, weekEnd, createdAt, createdBy
- [x] notes: id, residentId, houseId, text, source('manual'|'ocr'), imageFileId?, createdAt, createdBy
- [x] files: id, residentId, houseId, filename, mime, url, size, createdAt, createdBy
- [x] Ensure existing tracker tables have residentId, houseId, createdAt, createdBy

## Background Jobs
- [ ] Implement simple in-process queue (e.g., BullMQ/bee-queue) or async task runner
- [ ] OCR job (ocrWorker.ts): download image → Tesseract (or cloud OCR) → save text as Note (source='ocr') linked to file
- [ ] AI job (aiWorker.ts): consolidate week data → call ai.generateWeeklyReport() → return draft to API

## AI Provider Abstraction
- [ ] Environment variables:
  - [ ] AI_PROVIDER=gpt4all|ollama|openai
  - [ ] OPENAI_API_KEY (if openai)
  - [ ] OLLAMA_BASE_URL (if ollama)
  - [ ] WEEKLY_REPORT_TEMPLATE_PATH=server/templates/weeklyReport.md
- [ ] Create server/ai/index.ts with generateWeeklyReport function
- [ ] Implement provider switching logic
- [ ] Create prompt scaffold (backend) with SYSTEM and USER prompts

## Permissions & Audit
- [ ] Reuse requireAuth middleware
- [ ] Scope all creates/reads by houseId + residentId
- [ ] Add createdBy to all entities
- [ ] Implement basic audit log (action, userId, residentId, entity, entityId, ts)

## Voice-to-Text Frontend
- [ ] Create MicInput.tsx Hook with Web Speech API
- [ ] Start/stop recording functionality
- [ ] Insert at cursor position
- [ ] Add visual recording state
- [ ] Implement fallback: hide mic if API unavailable

## UX Polish
- [ ] Sidebar: add counts for each folder
- [ ] Sidebar: add "+ New" button per folder
- [ ] Report editor: "Regenerate with AI" button (idempotent)
- [ ] Report editor: "Save as Draft/Final" options
- [ ] Toasts for OCR/AI queued & completed
- [ ] Pagination or lazy-load for long lists

## Environment & Feature Flags
- [ ] Set up .env variables:
  - [ ] AI_PROVIDER=gpt4all
  - [ ] OPENAI_API_KEY=
  - [ ] OLLAMA_BASE_URL=http://localhost:11434
  - [ ] WEEKLY_REPORT_TEMPLATE_PATH=server/templates/weeklyReport.md
- [ ] Implement flags to allow disabling AI/OCR independently

## Acceptance Criteria
- [ ] Sidebar shows folders; clicking lists entries; open detail works
- [ ] All trackers save and appear in their folder; data survives reload
- [ ] Open Note creates a note; Scan Image saves image + OCR note linked
- [ ] Generate Weekly Report (AI) produces a draft that matches the existing template; editable; saved to Weekly Reports
- [ ] Voice mic works where supported; no crashes if unsupported
- [ ] Provider switch works across gpt4all | ollama | openai

## Tests / QA
- [ ] Create seed script: create demo house + resident
- [ ] API smoke tests: create/list notes/files/trackers/reports
- [ ] Manual QA: create data for a week → AI generate → verify sections filled or "No updates this week"

---

**Progress Tracking:**
- **Total Tasks:** Count checkboxes above
- **Completed:** Update as you complete tasks
- **Remaining:** Track what's left to implement