# Command Centre specification

## Purpose and current scope

Command Centre is a single-user local productivity system for today's obligations, overdue work, upcoming work, external information requiring review, and academic progress. Phase 1 provides the complete local core. Phase 2 connects one or more Google accounts through installed-desktop OAuth and ingests read-only Gmail and Google Calendar records.

Provider data remains separate from `Item` and authoritative academic records. Deterministic classification creates review proposals; only explicit user confirmation creates tasks, deadlines, assessments, or courses. There is no AI or LLM dependency.

## Architecture

```text
Electron main
  SQLite migrations and repositories
  CommandCentreService + IntegrationService
  GoogleProvider + deterministic classifier
  future portal manager / read-only MCP adapter
       ↕ validated narrow IPC
Sandboxed preload context bridge
       ↕ typed application operations
React renderer
```

SQLite and provider clients are never imported by the renderer. `CommandCentreService` remains the local application boundary. `IntegrationService` owns account lifecycle, sync state, idempotent provider upserts, and review proposals. Local reads never wait for network sync.

## Data model

Relational entities include institutions, programs, terms, courses, course modules, assessments, items, external records, integration accounts, review proposals, portal destinations, and app settings. Academic structure is database-driven; a new term and unrelated subjects require no source changes.

External records retain provider/account IDs, source URL, minimal mail/event content, timing, organizer/sender, location, provider update state, and classification state. Account-qualified provider IDs make repeated sync idempotent. Cancelled calendar events update provider status instead of deleting local history.

Review proposals preserve kind, confidence, matched course/institution, an optional explicit due date, reasons, edits, and confirmed/ignored state. Statistics activities retain submission and peer-review dates. Grading configuration remains per course and bonus stays separate from base T.

## Google integration

`IntegrationProvider` isolates provider behavior. The Google implementation requests only `openid`, `email`, `profile`, Gmail read-only, and Calendar read-only. OAuth runs in the system browser with PKCE, random state validation, and an ephemeral `127.0.0.1` loopback callback.

Initial Gmail synchronization is bounded to 30 days and 100 messages; later syncs query from the previous successful time. Gmail history IDs are retained for future refinement. Calendar uses Google's incremental sync token and recovers from an expired token using a bounded resync. A partial provider failure does not discard successful records or prior local data.

Gmail records pass through a local deterministic routing layer before persistence and classification. The provider account is transport, not authority for a record's Area. Configured sender, domain, recipient, label, and institution-domain rules take precedence; database-backed institution domains can recognize forwarded academic mail from original-recipient and forwarding headers. Promotions, Social, spam/trash, bulk/newsletter mail, routine Google security messages, and low-confidence personal mail are excluded by default. Starred, important, direct correspondence, and explicit include rules remain eligible. Only records routed to an academic institution can enter academic classification. Re-evaluation archives records that no longer qualify and rebuilds pending proposals idempotently without deleting source records.

The classifier loads active course codes and names from current/upcoming terms in SQLite. It uses deterministic keywords and accepts only explicit full dates. Unknown course-like codes enter a generic new-course proposal flow.

## Security principles

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and web security enabled.
- Preload exposes business operations, never `ipcRenderer`, filesystem, SQL, provider clients, or tokens.
- Main validates IPC senders and mutating payloads with Zod.
- Google access/refresh credentials are stored through macOS Keychain's generic-password API; SQLite contains only non-secret identity, scopes, and sync state.
- Token values are never logged or returned to the renderer.
- Renderer navigation and new windows are denied. Open Original accepts HTTPS URLs only and delegates to the system browser.
- Future portals must run without preload, Node access, credential access, or Command Centre IPC.
- Backups use SQLite's consistent snapshot operation and migrations are additive.

## Design system

The app uses compact persistent navigation, restrained borders, subtle surfaces, dense lists, strong typography, visible focus states, semantic controls, and first-class light/dark themes. Sync and review states extend the existing design language without turning the product into a generic dashboard.

## Future integrations and MCP

The next provider can implement the same abstraction for Microsoft delegated identity, mail read, and calendar read while respecting tenant consent restrictions. A future local read-only MCP server will call purposeful service operations and expose neither SQL, files, credentials, nor mutations.

## Explicit non-goals

No OpenAI/Anthropic/Gemini APIs, LLMs, embeddings, vector database, chatbot, hosted backend, mail sending/modification, Drive access, portal scraping, mobile client, multi-user features, CRM, Microsoft OAuth in Phase 2, or insecure portal workarounds.
