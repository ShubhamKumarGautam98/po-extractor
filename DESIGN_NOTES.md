# Design Notes — PO Extractor

Architecture decisions, assumptions, and tradeoffs made during development.

---

## Why n8n as the Pipeline Engine

The core processing pipeline runs inside n8n rather than a custom backend for three reasons:

1. **Visibility** — every step of the pipeline is a named node in n8n. A non-technical user can open the workflow and see exactly what happened at each stage. This is directly valuable in a BPM environment where process transparency matters.

2. **Extensibility** — adding a new transformation rule requires only a CSV row change. Adding a new pipeline step (e.g. push to ERP) requires adding one n8n node. No code deployment needed for either.

3. **Open-source first philosophy** — n8n is self-hostable, has zero per-user licensing cost, and supports custom code nodes. This makes it the right choice for organisations that want enterprise-grade automation without enterprise-level licensing overhead.

---

## Why an AI Language Model for Extraction

The five sample POs have completely different layouts:

- BrightKids uses a clean tabular format
- ThreadHaven (George) spans multiple pages with split/delivery sections
- Raj International uses ratio pack notation with dual-column layouts

A rules-based parser (regex, pdfplumber field coordinates) would require a separate parsing profile per customer format. Every new customer onboarded would require a code change.

An AI language model reads the PDF as a document and extracts facts semantically, regardless of layout. The extraction prompt instructs it to return only observable facts and flag anything missing — never guess. This makes the extractor robust by design rather than brittle by implementation.

---

## CSV-Driven Transformation

The transformer reads `transformation_data.csv` at runtime on every execution. This means:

- Adding a new supplier requires one CSV row — zero code changes
- Adding a new port mapping requires one CSV row — zero code changes
- The transformation rules are visible and editable by non-developers
- The CSV can be replaced with a database table in production with no code changes

Rule types supported:
- `source_detection` — identifies customer from document branding
- `header_default` — constants applied to every PO
- `division_lookup` — derives division code from customer code
- `vendor_lookup` — maps vendor/supplier number to internal codes
- `incoterm_lookup` — maps incoterm codes to full text
- `country_lookup` — maps country name to ISO code
- `port_lookup` — maps port text to port code
- `destination_lookup` — maps destination to discharge port and final destination
- `season_lookup` — normalises season codes (handles Raj "AW" → "AW26" edge case)
- `factory_lookup` — maps factory number to internal factory ID

---

## Status and Issues Design

Rather than failing silently or guessing missing values, the pipeline:

1. Sets `status: needs_review` when any required field is empty
2. Populates the `issues` array with the exact field and section that failed
3. Surfaces these issues in the UI so the user can fill them in manually

This is intentional — in a production order processing environment, a wrong value entered into an ERP is more damaging than a flagged missing value. The system prefers transparency over false confidence.

---

## Assumptions Made

1. **One PO per PDF** — the spec states one PO per file. Multi-PO PDFs are out of scope.
2. **FOB is the default incoterm** — all sample POs use FOB. The CSV lookup handles this.
3. **Season year inference** — Raj POs print only "AW" as the season code. The season_lookup rule in the CSV maps "AW" → "AW26" based on the product description context. If a future PO uses "AW27", a single CSV row addition handles it.
4. **USD as default currency** — all sample POs use USD. The pr_default rule sets this.
5. **Style number extraction** — some POs print the style number explicitly, others embed it in the product description. The extraction prompt instructs the model to find it in either location.

---

## Tradeoffs

| Decision | Chosen | Alternative | Reason |
|----------|--------|-------------|--------|
| Pipeline engine | n8n | FastAPI | Visual pipeline, open-source, zero licence cost |
| PDF extraction | AI language model API | pdfplumber + regex | Handles layout variation without per-customer code |
| Transformation config | CSV file | Hardcoded rules | Data-driven, editable without deployment |
| Frontend | React + Vite | Plain HTML | Component reuse, live revalidation on edit |
| Deployment | Docker Compose | Manual install | One command setup for evaluator |

---

## What I Would Add for Production

1. **Persistent storage** — save extracted POs to a database (PostgreSQL) so users can retrieve past extractions
2. **Webhook authentication** — add API key validation to the n8n webhook so only the frontend can trigger it
3. **Extraction caching** — cache AI API responses by PDF hash to avoid re-extracting identical documents
4. **CI/CD pipeline** — GitHub Actions workflow to run tests and build Docker images on push
5. **Multi-PO batch processing** — allow uploading a zip of PDFs and processing them in parallel
6. **ERP push node** — add an n8n node at the end of the pipeline to push validated JSON directly to the target ERP via API
7. **Audit logging** — log every extraction with timestamp, user, and status for compliance traceability
8. **Self-hosted AI model** — replace the managed API call with Ollama or vLLM running Llama 3.1 or Mistral 7B for zero per-call cost and full data sovereignty