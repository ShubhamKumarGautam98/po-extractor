# PO Extractor

A web application that extracts, transforms, and validates Purchase Order data from PDF documents using an n8n automation pipeline powered by AI.

---

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- An API key for the AI extraction service (see API Key & Data Security Policy section below)

### 1. Clone and setup
```bash
cd "NT Test_Project"
cp .env.example .env
```

Open `.env` and add your API key:
```
ANTHROPIC_API_KEY=your_key_here
```

### 2. Copy transformation data
Make sure `transformation_data.csv` is inside the `config/` folder.

### 3. Start the application
```bash
cd docker
docker-compose up --build
```

### 4. Import the n8n workflow
1. Open http://localhost:5678 in your browser
2. Complete the n8n setup (create owner account)
3. Click **Add workflow → Import from file**
4. Select `n8n-workflow/po_workflow_working.json`
5. Click **Publish** (green circle confirms active)

### 5. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

### 6. Open the app
Visit http://localhost:3001

---

## How to Use

1. Upload a Purchase Order PDF
2. Wait for the AI to extract the data (~10-15 seconds)
3. Review and edit the extracted fields
4. Click **Export JSON** to download the structured output

---

## Sample Outputs

Pre-processed outputs for all 5 sample POs are in the `sample_outputs/` folder for immediate review without running the pipeline:

| File | Customer | Status | Notes |
|------|----------|--------|-------|
| `PO_2450187.json` | BrightKids | needs_review | 2 deliveries, 26 items |
| `PO_1208545.json` | ThreadHaven (George) | needs_review | 3 deliveries, 33 items |
| `PO_1208546.json` | ThreadHaven (George) | needs_review | Prepack PO |
| `PO_461-38901.json` | Raj International | artifact_ready | Ratio packs, full destination |
| `PO_461-38931.json` | Raj International | artifact_ready | Ratio packs, full destination |

`needs_review` status on BrightKids and George POs is expected — those documents do not print a destination location, so the system correctly flags the missing fields rather than guessing.

---

## Project Structure

```
NT Test_Project/
├── config/
│   ├── transformation_data.csv     # CSV-driven transformation rules
│   ├── extraction_prompt.txt       # AI extraction prompt
│   └── field_schema.json           # Required fields for validation
├── n8n-workflow/
│   ├── po_workflow_working.json    # Importable n8n workflow
│   └── nodes/
│       ├── extractor.js            # AI PDF extraction logic
│       ├── transformer.js          # CSV-driven transformation engine
│       └── validator.js            # Field validation and status
├── frontend/
│   └── src/
│       ├── App.jsx                 # Main app and screen management
│       ├── api.js                  # n8n webhook communication
│       └── components/
│           ├── Upload.jsx          # PDF upload screen
│           └── Review.jsx          # Data review and edit screen
├── docker/
│   ├── docker-compose.yml          # n8n + frontend services
│   └── Dockerfile.frontend         # React production build
├── tests/
│   └── transformer.test.js         # 36 transformer unit tests
├── sample_outputs/                 # Pre-processed JSON for all 5 POs
├── .env.example                    # Environment variable template
├── README.md                       # This file
└── DESIGN_NOTES.md                 # Architecture decisions and tradeoffs
```

---

## Pipeline Architecture

```
PDF Upload (React)
      ↓
Webhook Trigger (n8n)
      ↓
Prepare Request (Code node) — builds API request body
      ↓
Call AI API (HTTP Request node) — extracts raw facts from PDF
      ↓
Parse + Transform (Code node) — applies CSV transformation rules
      ↓
Validator (Code node) — checks required fields, sets status
      ↓
JSON Response → React Review UI → Export
```

---

## Supported PO Formats

| Customer | Format | Special Handling |
|----------|--------|-----------------|
| BrightKids | Simple flat layout | Multiple deliveries |
| ThreadHaven (George) | Multi-page | 3 deliveries, prepacks |
| Raj International | Ratio pack format | Pack A/B, AW→AW26 season inference |

---

## Running Tests

```bash
cd "NT Test_Project"
node tests/transformer.test.js
```

Expected output: **36 passed | 0 failed**

---

## API Key & Data Security Policy

### Why an API key is required

This pipeline uses an AI language model as the extraction engine inside the n8n workflow. The API key is the authentication token that:
- Authorises the n8n HTTP Request node to call the AI service
- Ensures all data in transit is tied to an authenticated identity
- Provides usage tracking and audit trails — critical in enterprise environments

This mirrors exactly how enterprise systems work — every external API integration in a production BPM environment requires a managed authentication token, whether that is an AI provider key, an Azure AD token, or an AWS IAM credential.

### How I handled the key for this submission

For security reasons, I intentionally did not include a live API key in this repository. Instead, I used separate keys during development to generate all sample outputs — which are included in the `sample_outputs/` folder for your review.

This is a deliberate choice. Committing a live API key to a repository — even a private one — is a security anti-pattern. In a real enterprise deployment, API keys would be managed via:
- Environment variables (`.env` files, never committed to git)
- A secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
- n8n's built-in credentials store

### Running the pipeline yourself

To run the pipeline end-to-end, you will need your own API key:

1. Create an account at https://console.anthropic.com
2. Generate an API key
3. Open `n8n-workflow/po_workflow_working.json`
4. Replace the `x-api-key` value in the `Call Claude API` node headers
5. Re-import the workflow in n8n and publish

All 5 sample PO outputs are pre-generated and available in the `sample_outputs/` folder for immediate review without running the pipeline.

### Alternative — flexible API cost management

Depending on the organisation's requirements and budget, the API key can be managed across a full spectrum — from low cost to zero cost.

**Why I used a managed API key for this submission:**

For a 2-3 day evaluation project, a managed API key was the right pragmatic choice. Setting up and fine-tuning a self-hosted model for production-quality PDF extraction requires infrastructure setup and model evaluation time that goes beyond the scope of this assessment. A managed key delivered reliable, high-quality extraction results immediately — allowing full focus on what this test is actually evaluating: the pipeline architecture, CSV-driven transformation logic, and separation of concerns.

More importantly, the architecture was deliberately built to be provider-agnostic from day one. Validating the pipeline with a managed key first — then swapping to a lower-cost or zero-cost provider — is standard engineering practice in any real project.

**Option 1 — Managed API key (current approach)**
- Use any AI provider's API (Anthropic, OpenAI, Google Gemini)
- Pay per use — ideal for low volume or evaluation
- No infrastructure overhead
- Switch providers by changing one URL in one n8n node

**Option 2 — Self-hosted open-source model (zero cost)**
- **Model**: Llama 3.1 or Mistral 7B (both support document understanding)
- **Runtime**: Ollama or vLLM on internal infrastructure
- **Integration**: Same n8n HTTP Request node — only the endpoint URL changes
- Zero per-call cost at any volume
- Full data sovereignty — data never leaves your infrastructure
- Critical for clients with strict confidentiality requirements
- No dependency on external API availability or pricing changes
- Audit-ready — all processing stays within your cloud domain

**The key design decision:**
The AI provider is completely decoupled from the pipeline. Swapping from a managed key to a self-hosted model — or between providers — requires changing one URL and one authentication header in one n8n node. No code changes. No pipeline redesign. The organisation chooses the option that fits their cost, compliance, and infrastructure requirements.

---

## AI & OCR Policy

This application uses an AI language model (`claude-sonnet-4-5`) for PDF data extraction via the n8n HTTP Request node.

- PDFs are sent as base64-encoded documents directly to the AI API
- No OCR library is used — the model reads the PDF natively as a document
- No PDF data is stored or logged beyond the active session
- The extraction prompt instructs the model to extract only observable facts — never invent values
- Missing fields are explicitly flagged in the `issues` array rather than guessed

### Why AI over traditional OCR?

Traditional OCR tools (pdfplumber, PyMuPDF) extract raw text but require per-customer parsing rules — every new PO layout breaks the parser. The 5 sample POs all use completely different layouts across 3 customers. An AI language model reads documents semantically, handling all layout variations with a single prompt. This makes the extractor layout-agnostic by design — the same pipeline works for any new customer without code changes.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Pipeline engine | n8n (self-hosted) | Visual workflow, open-source, zero licence cost |
| AI extraction | Language model API | Handles all PDF layouts without per-customer rules |
| Transformation | CSV-driven (no-code) | Data-driven, editable without deployment |
| Frontend | React + Vite | Component reuse, live revalidation on edit |
| Deployment | Docker Compose | One command setup |