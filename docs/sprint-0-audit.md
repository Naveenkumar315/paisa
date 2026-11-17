# Sprint 0 — Existing Application Audit

**App:** Moneytrail (formerly Paisa → Outflow; renamed in commit `54bc099`). The 2.0 blueprint calls it "Outflow".
**Repo:** `c:\Naveen\Learning` — `paisa-api/` (backend) + `paisa-web/` (frontend). Remote: `github.com/Naveenkumar315/paisa`.
**Date:** 2026-11-13 · **Scope:** read-only. No source, schema or data was changed.

Legend: **[V]** verified by reading code or querying the database · **[A]** assumption / not verified.

---

## 1. Executive summary

The app is smaller and more disciplined than the blueprint assumes. ~2,400 lines of Python and ~4,400 lines of TypeScript, with careful choices already made: money as integer paise, deduplication enforced by a unique index, user scoping on every query, and an Ask agent that can only call a fixed set of server-side tools and records every step.

**Five things change the blueprint:**

1. **The database is MongoDB 8.0, not SQL.** [V] Accessed through the Beanie ODM. There are no tables, no SQL, no migration tool. "Migrations" in the blueprint must become versioned, idempotent Python scripts (or Beanie migrations). Indexes are created automatically at app startup from `app/db/models.py`, so adding a *unique* index to data that already violates it will **stop the API from booting**.
2. **The backend is already Python/FastAPI.** [V] The blueprint's separate "AI / Python service" is unnecessary — the AI already runs in-process. There is no backend `package.json`; dependencies are in `paisa-api/requirements.txt`.
3. **Money is already stored as integer paise.** [V] Better than the blueprint's "decimal" suggestion. Keep it.
4. **The AI layer already meets most of blueprint §4.** [V] Fixed tool registry, user ID injected server-side, no generated queries, full trace per answer. Sprint 5 is an extension, not a rebuild.
5. **"Spending" currently includes money sent to people.** [V] This is deliberate in code but directly contradicts the blueprint rule *"Never silently classify transfers as expenses."* This needs a product decision before Sprint 1 (see §11, R2).

**Most important defect found:** imported transactions are **not linked to their statement**. `import_service.py` passes `statement_id`, but the `Transaction` model has no such field, so Pydantic silently discards it. **0 of 1,073** stored transactions have a `statement_id`. [V]

---

## 2. Technology stack

| Layer | Technology | Version | Source |
|---|---|---|---|
| Frontend framework | React | ^19.3.1 | `paisa-web/package.json` [V] |
| Build | Vite (+ `@vitejs/plugin-react`) | ^8.3.5, port 3000 | `paisa-web/vite.config.ts` [V] |
| Language | TypeScript | ~7.0.2 | [V] |
| Styling | Tailwind CSS v4 (`@theme` tokens in CSS) | ^4.3.3 | `paisa-web/src/index.css` [V] |
| Server state | TanStack React Query | ^5.105 | [V] |
| Client state | Zustand (with `persist`) | ^5.0.16 | [V] |
| Routing | react-router-dom (data router) | ^7.18.4 | [V] |
| HTTP | axios | ^1.21 | [V] |
| Charts | Recharts | ^3.10.1 | [V] |
| Toasts | react-hot-toast | ^2.6.1 | [V] |
| Lint | oxlint | ^1.89 | [V] |
| Backend framework | FastAPI / Starlette / Uvicorn | 0.162 / 1.10 / 0.54 | `requirements.txt` [V] |
| ODM / driver | Beanie 2.2 on `pymongo.AsyncMongoClient` 4.19 | | `app/db/session.py` [V] |
| Database | MongoDB **8.0.26**, local, db name `paisa` | | live query [V] |
| Auth | PyJWT (HS256) + bcrypt | | `app/core/security.py` [V] |
| PDF parsing | pdfplumber | 0.11.10 | `app/services/gpay_parser.py` [V] |
| LLM | Azure OpenAI via `openai` SDK (`AsyncAzureOpenAI`) | deployment from env | `app/services/llm.py` [V] |
| Embeddings (research only) | `google-genai` (Gemini embeddings) | | `scripts/` only, not used by the app [V] |
| Tests / CI | **None** | | [V] |
| Deployment | Local dev only; no Dockerfile, no CI config | | [V] |

**Unused dependencies in `requirements.txt`:** `motor` (code uses pymongo's async client), `sentry-sdk`, `fastapi-cloud-cli`, `google-genai` (scripts only). [V]

---

## 3. Frontend architecture

```
paisa-web/src/
├── main.tsx                 QueryClient + RouterProvider + Toaster; initTheme()
├── routes.tsx               all routes (createBrowserRouter)
├── App.tsx / App.css        dead — unused Vite template
├── api/
│   ├── client.ts            axios instance, bearer token + 401 redirect interceptors, errorMessage()
│   ├── queries.ts           React Query hooks + central query keys
│   ├── analytics.ts  statements.ts  auth.ts      (support VITE_USE_MOCKS)
│   ├── payees.ts  ask.ts                          (no mock support)
│   └── mocks.ts             655 lines of sample data — see R14
├── components/
│   ├── ProtectedRoute.tsx   token gate → /login
│   ├── layout/AppShell.tsx  sidebar (Dashboard, Ask, Payees, People), theme toggle, sign out
│   └── ui/                  Avatar, Badge, BarRow, Button, Card, DataTable, Stat, ThemeToggle
├── features/
│   ├── auth/                LoginPage, Registerpage
│   ├── dashboard/           DashboardPage + 13 chart/panel components, chartTheme.ts
│   ├── ask/                 AskPage, TracePanel
│   ├── payees/PayeesPage    list + set category + re-run LLM
│   ├── people/PeoplePage    two-way balances + per-person ledger
│   └── statements/StatementUpload   block + inline variants
├── lib/                     cn.ts (clsx+tailwind-merge), format.ts (money/date)
├── stores/                  auth.ts, theme.ts, ui.ts (Zustand)
└── types/api.ts             shared response types
```

**Routing** [V] — `src/routes.tsx`: `/login`, `/register` public; `ProtectedRoute → AppShell →` `/dashboard`, `/ask`, `/payees`, `/people`; `*` → `/dashboard`. No lazy loading.

**State** [V] — server data in React Query (keys centralised in `api/queries.ts`); UI-only state in Zustand (`ui.ts`: selected month, chart labels). After an upload, `useUploadStatement` invalidates *all* queries.

**Inconsistency** [V] — the dashboard (`DashboardPage.tsx:23-35`), `PeoplePage.tsx:28-40` and `PayeesPage.tsx:25` define fetchers and query keys inline instead of in `api/` + `queries.ts`. Not a bug, but new modules should follow the `api/` + `queries.ts` pattern.

**Theming** [V] — `<html class="dark">` toggled by `stores/theme.ts` (light/dark/system, persisted as `paisa-theme`), applied before first paint by an inline script in `index.html`. Colours are CSS tokens in `index.css` (`--color-*`, `--chart-*` "Vivid" category palette); `features/dashboard/chartTheme.ts` maps categories to tokens.

**Money/date display** [V] — `lib/format.ts`: `money()`, `moneyExact()`, `compact()` (k / L), `shortDate()`, `monthLabel()`. All amounts arrive as paise and are divided only at display time.

**Reusable components** — see §10.

---

## 4. Backend architecture

```
paisa-api/app/
├── main.py              app factory, CORS, routers, lifespan (init/close Mongo), /health, /health/db
├── core/
│   ├── config.py        pydantic-settings, reads .env
│   ├── security.py      bcrypt hash/verify, JWT create/decode
│   ├── errors.py        AppError/NotFound/Conflict/Unauthorized → {"error":{code,message}}; catch-all 500
│   ├── middleware.py    request id (x-request-id), timing log
│   └── logging.py       console + rotating file logs/app.log
├── db/
│   ├── session.py       AsyncMongoClient + init_beanie
│   └── models.py        all 6 document models + indexes
├── api/                 routers (thin): auth, statements, payees, analytics, ask; deps.get_current_user
├── schemas/             request/response Pydantic models (auth, statements, analytics)
└── services/            business logic
    ├── auth_service.py      register/authenticate
    ├── gpay_parser.py       PDF → ParsedTxn
    ├── import_service.py    validate upload, parse, insert with dedupe
    ├── categorize_service.py LLM payee categorisation
    ├── analytics_service.py all dashboard aggregations
    ├── tools.py             Ask tool schemas + handlers
    ├── agent_service.py     tool-calling loop + tracing
    ├── llm.py               Azure OpenAI wrapper
    └── ask.py               empty file (dead)
```

**Request flow** [V]: Uvicorn → CORS → request-id/timing middleware → router → `Depends(get_current_user)` (bearer JWT → `User.get(sub)`) → service → Beanie/aggregation → Pydantic response model (or plain dict) → errors converted by `register_error_handlers`.

**Pattern:** routes are thin, logic is in services. Clean layering; new modules should copy it.

**Validation** [V]: Pydantic request bodies; `Query(ge/le)` on pagination; months validated as `YYYY-MM` in tools only (analytics endpoints accept any string and return empty/404).

**Error handling** [V]: consistent `{"error": {"code", "message"}}` for errors. Success responses are **not enveloped** — the frontend reads `data` directly. An invalid ObjectId in a path (`/ask/runs/xyz`) raises `bson.InvalidId` → generic 500 instead of 400/404.

**Logging** [V]: request line per call with request id; business events (`statement_imported`, `agent_tool`, `llm_call` token counts). `logs/app.log` is gitignored.

**Background jobs** [V]: none. LLM categorisation runs *inside* the upload request (`api/statements.py:41`).

**Config / secrets** [V]: `.env` (gitignored) contains only Gemini and Azure OpenAI settings. **`JWT_SECRET` and `MONGO_URI` are not set**, so the code defaults are in use, including `jwt_secret="change-me-in-env"` (see R7). `paisa-web/.env` *is* committed but contains only `VITE_API_URL` and `VITE_USE_MOCKS`.

---

## 5. Actual database schema (MongoDB `paisa`)

Collections are defined in `app/db/models.py`; indexes are created by `init_beanie` at startup. Document counts from the live database on 2026-11-13. [V]

### `users` — 3 docs
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `email` | str | lower-cased on write; **unique index** |
| `name` | str | |
| `password_hash` | str | bcrypt |
| `created_at` | datetime (UTC) | |

### `transactions` — 1,073 docs
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | ObjectId | owner; no FK (Mongo) |
| `txn_id` | str | UPI transaction ID from the statement |
| `occurred_at` | datetime | **naive IST wall-clock, stored as if UTC** (R10) |
| `direction` | str | `"debit"` \| `"credit"` |
| `is_self_transfer` | bool | from "Self transfer to" lines |
| `counterparty_raw` | str | payee name exactly as printed |
| `amount_paise` | int | always > 0 (verified: 0 rows ≤ 0) |
| `bank`, `account_last4` | str | the user's own account used |
| `created_at` | datetime (UTC) | |

Indexes: **unique `(user_id, txn_id)`** — the dedupe guarantee; `(user_id, occurred_at desc)`.
Breakdown: 957 debit · 92 credit · 24 self-transfer (debit). 3 users have transactions.
**Missing:** `statement_id` (0 / 1,073 — R1), category, type, notes, tags, soft delete, `updated_at`.

### `statements` — 4 docs
| Field | Type | Notes |
|---|---|---|
| `user_id` | ObjectId | **no index** |
| `original_filename` | str | |
| `period_start`, `period_end` | datetime | min/max of parsed rows, not the statement header |
| `rows_parsed`, `rows_inserted`, `rows_duplicate` | int | |
| `imported_at` | datetime | |
| `file_key` | str | **legacy field on 2 docs** — left from an earlier version that stored the PDF (R6) |

No file hash, no status, no debit/credit totals. Sum of `rows_inserted` = 1,021 vs 1,073 transactions → **52 transactions have no statement record**. 1 statement shows `rows_inserted = 0` (a full re-upload).

### `payees` — 545 docs
| Field | Type | Notes |
|---|---|---|
| `user_id` | ObjectId | |
| `name` | str | equals `transactions.counterparty_raw` exactly; **unique `(user_id, name)`** |
| `category` | str | one of: food, groceries, travel, mobile, health, shopping, transfer, other |
| `source` | str | `"llm"` (544) \| `"user"` (1) — user choices are never overwritten |
| `created_at` | datetime | |

Relationship to transactions is **by name string**, joined at query time with `$lookup`. 518 distinct counterparties; 3 have no payee doc (uncategorised); **7 groups differ only by letter case** (e.g. same shop written two ways) and are treated as separate payees.

### `agent_runs` — 35 docs (one per Ask question)
`user_id`, `question`, `answer`, `steps`, `tokens`, `duration_ms`, `created_at`, `thread_id` (15 of 35 — older runs predate threads; the first run's own `_id` is the thread id).
Indexes: `(user_id, created_at desc)`, `(user_id, thread_id, created_at desc)`.

### `agent_steps` — 96 docs (one per tool call or answer)
`run_id`, `step_no`, `kind` (`tool`/`retry`/`answer`), `tool_name`, `arguments` (dict), `result` (dict), `duration_ms`, `created_at`. Index `(run_id, step_no)`.

### Relationships
```
users 1─* transactions   (user_id)
users 1─* statements     (user_id)
statements 1─* transactions   ← intended, BROKEN (statement_id dropped)
users 1─* payees         (user_id)
payees 1─* transactions  (user_id + name == counterparty_raw, by string)
users 1─* agent_runs 1─* agent_steps (run_id)
agent_runs grouped by thread_id = "conversation"
```

**Data isolation** [V]: every query, aggregation and tool handler filters on `user_id` taken from the JWT. `get_trace` checks run ownership. Ask history lookup filters on user. No cross-user leak was found.

**Other databases on the same server** [V]: `IncomeAnalyzer`, `User`, `accounts_payable`, `income_analyzer`, `interview_copilot`, `sample` — unrelated to this app, not touched.

---

## 6. API inventory

No `/api/v1` prefix. All routes except auth/health require `Authorization: Bearer <jwt>`. [V]

| Method | Path | Handler | Returns |
|---|---|---|---|
| GET | `/health` | `main.py` | `{status, app, env}` |
| GET | `/health/db` | `main.py` | `{mongo: up/down}` |
| POST | `/auth/register` | `api/auth.py` | `TokenOut {access_token, token_type, user}` · 201 / 409 |
| POST | `/auth/login` | `api/auth.py` | `TokenOut` · 401 |
| GET | `/auth/me` | `api/auth.py` | `UserOut` |
| POST | `/statements` | `api/statements.py` | multipart `file` → `StatementOut` · 201 / 413 / 415 / 422; triggers LLM categorisation of new payees |
| GET | `/statements` | `api/statements.py` | `StatementOut[]` newest first |
| GET | `/statements/transactions?limit&offset` | `api/statements.py` | `TransactionPage {items,total,limit,offset}` — no filters |
| GET | `/payees` | `api/payees.py` | `[{name, category, source}]` |
| PUT | `/payees/{name}` | `api/payees.py` | set category (`source="user"`) |
| POST | `/payees/categorize` | `api/payees.py` | re-run LLM on all non-user payees |
| GET | `/analytics/months` | `api/analytics.py` | `MonthSummary[]` |
| GET | `/analytics/summary?month=YYYY-MM` | | `MonthSummary` · 404 (recomputes all months, then picks one) |
| GET | `/analytics/payees?limit&month` | | `PayeeSummary[]` |
| GET | `/analytics/clock` | | `ClockBucket[]` (4 time-of-day buckets) |
| GET | `/analytics/categories?month` | | `CategorySlice[]` |
| GET | `/analytics/people` | | two-way balances |
| GET | `/analytics/people/{name}` | | per-person ledger with running balance |
| GET | `/analytics/daily` | | per-day spending (heatmap) |
| GET | `/analytics/category-trend` | | per-month × category |
| GET | `/analytics/mobile-recharges` | | recharge counts by operator/amount/month |
| POST | `/ask` | `api/ask.py` | `{question, thread_id?}` → `{run_id, thread_id, answer, steps, tokens, duration_ms}` |
| GET | `/ask/threads` | | thread list |
| GET | `/ask/runs?limit` | | recent runs |
| GET | `/ask/runs/{run_id}` | | full step trace |

**Not present:** refresh token, logout, transaction create/update/delete, transaction filters/search, export, accounts, budgets, goals, recurring, notifications.

**Response format:** success = bare model/array; error = `{"error":{"code","message"}}`. The blueprint's `{success, data, meta, error}` envelope would break every existing frontend call. **Recommendation:** keep the existing shape, and only use the envelope on new `/api/v1` routes if you want it there.

---

## 7. Transaction data flow and classification

### How each kind of money movement is identified today [V]

| Blueprint question | Current behaviour | Where |
|---|---|---|
| Expenses | Every `debit`, not self-transfer, **including transfers to people**, is "spending". | `analytics_service.py:9-13, 50-80` |
| Incoming payments | Every `credit` → bucket `received`. Nothing distinguishes salary, refund, or a friend paying back. | `analytics_service.py:55-58` |
| Person-to-person transfers | Payee category `transfer` (set by LLM or user) → bucket `transfer`. **Fallback:** an *unlabelled* debit ≥ ₹2,000 is assumed to be a transfer. `transfer` is reported separately but **also counted inside `spending_paise`**. | `analytics_service.py:7, 59-76, 127-129` |
| Own-account transfers | `is_self_transfer` from the PDF's "Self transfer to" wording → bucket `self`, excluded from spending. Only the debit side exists; the receiving account's credit is not in a GPay statement. | `gpay_parser.py:77` |
| Refunds / reversals | **Not modelled.** A merchant refund is a `credit` → "received" (looks like income); the original expense stays in spending. | — |
| Payee normalisation | **None.** `counterparty_raw` is whitespace-collapsed only; the payee key is the raw string, and comparisons are case-sensitive. | `gpay_parser.py:78-79`, `models.py Payee` |
| Duplicate detection | Unique index `(user_id, txn_id)` + `insert_many(ordered=False)`; duplicate-key errors are counted, anything else is re-raised. Safe under concurrency because the database enforces it. | `models.py`, `import_service.py:92-112` |
| Link to statement | **Broken** — R1. | `import_service.py:63` |

### Classification is per payee, not per transaction [V]
The category comes from a `$lookup` to `payees` on every query. One label covers every payment to that payee, and no single transaction can be reclassified. The `$lookup` + bucketing pipeline (`_with_category()`) is shared by analytics and Ask tools — **this is the single place to centralise classification in Sprint 1**.

### Double-counting and definition risks
- **"People" means two different things.** [V] The People page (`people_balances`) counts any counterparty with both debits *and* credits, whatever its category. The dashboard's "Transfers" means category `transfer`. A shop you split a bill with appears on People, and a person you only pay doesn't.
- **Loan repaid = income.** [V] Lending ₹50,000 counts in spending; getting it back counts as received. People nets it, but the dashboard does not.
- **Tools disagree on what counts.** [V] `get_payee_total` and `find_payments` count every non-self debit, while `get_spending`/`top_payees` use the bucket logic. For a payee this happens to agree, but it is two definitions.
- **₹2,000 heuristic** [V] changes a payment's bucket depending on whether the LLM labelled the payee yet. Totals for past months can change after a re-categorisation run.

---

## 8. Statement import data flow [V]

```
StatementUpload.tsx  (client: .pdf extension check, drag/drop)
  → POST /statements multipart
api/statements.py: await file.read()            ← whole file in memory before size check
import_service._parse_upload
  · extension must be .pdf (no magic-byte / MIME check)
  · size ≤ MAX_UPLOAD_MB (20)
  · write NamedTemporaryFile → gpay_parser.parse_statement → os.unlink   (file not kept)
gpay_parser
  · pdfplumber.extract_text(x_tolerance=1.5) per page
  · HEADER regex: "DD Mon, YYYY  Paid to|Received from|Self transfer to  NAME  ₹amount"
  · next 1–3 lines: DETAIL (time + UPI txn id) — row skipped silently if missing
                    ACCOUNT ("Paid by|to BANK 1234") — optional
  · amount: Decimal(str without commas) * 100 → int paise
  · datetime: naive, "%d %b, %Y %I:%M %p"
import_service.import_statement
  1. no rows → 422 "Is this a Google Pay statement?"
  2. INSERT Statement (counts = 0)
  3. insert_many(transactions, ordered=False)   ← statement_id dropped here (R1)
  4. UPDATE Statement counts
api/statements.py: if rows_inserted → categorize_service.categorize_all(only_new=True)
  · LLM failure is logged and swallowed; the import is kept
  → StatementOut; frontend invalidates every query
```

**Gaps against blueprint §3.4** [V]:
- Format: Google Pay PDF only. No CSV/XLSX/bank statements, no OCR.
- No preview/review step; rows go straight in.
- **Rows that fail to parse are not counted or reported.** A header with no detail line is skipped with no record. `rows_parsed` counts only successes, so "failed records" can't be shown.
- No file hash, so the same file creates a new `statements` record each time (with 0 inserted).
- No reconciliation: the GPay PDF's own summary totals are not extracted or compared.
- Not atomic: if step 3 fails with a non-duplicate error, the statement row stays with zeros. Multi-document transactions need a replica set; whether local Mongo runs as one is **not verified [A]**.
- Categorisation is synchronous, so upload latency includes LLM round-trips (batches of 40 payees).
- Dates are taken from the PDF with no timezone; IST is implied.

---

## 9. AI implementation analysis [V]

| Question | Finding |
|---|---|
| Provider / model | Azure OpenAI Chat Completions via `AsyncAzureOpenAI`; model = `AZURE_OPENAI_DEPLOYMENT` env var (name not inspected). `temperature=0`, `max_retries=3`. `app/services/llm.py` |
| Uses | (a) payee categorisation, JSON mode, `categorize_service.py`; (b) Ask agent with tool calling, `agent_service.py` |
| Prompt structure | Ask: fixed system prompt (numbers must come from tools, call `list_months` for relative dates, 2–3 sentence answers) + last 4 Q/A pairs of the thread + question. Categoriser: rule-based prompt with payee aggregates (count, average, time of day, money returned). |
| Data retrieval | 6 tools in `tools.py`: `get_spending`, `get_payee_total`, `compare_months`, `top_payees`, `find_payments`, `list_months`. Each is a fixed Mongo aggregation. |
| Deterministic queries? | **Yes.** The model picks a tool and arguments; it cannot write queries. Months are validated (`YYYY-MM`), categories are an enum, and `top_payees` limit is capped at 20. |
| User isolation | `run_tool(user_id, …)` passes the user from the JWT; the model has no way to set it (an injected `user_id` argument causes a TypeError, which is returned as an error). |
| Can the AI make up numbers? | **Reduced, not eliminated.** The system prompt forbids it and tools return pre-formatted rupee strings, but nothing *checks* that numbers in the answer appear in tool results. The blueprint's "result validator" doesn't exist yet. |
| Conversation storage | `agent_runs` (question + answer) grouped by `thread_id`; `agent_steps` store every tool call with arguments, result and timing; `TracePanel.tsx` shows them. This already covers blueprint `ai_conversations` / `ai_messages` / `ai_tool_runs`. |
| Safety caps | `MAX_STEPS = 8`; question 3–500 chars. No per-user rate limit or token budget. |
| Data sent to the provider | Payee names (many are private individuals' names) plus aggregates; tool results with payee names and amounts. No UPI IDs, account numbers or emails are sent (by design, `categorize_service._describe`). There is no consent or data-control setting. |
| RAG / embeddings | Embedding approach tried and rejected for categorisation (`paisa-api/README`, `docs/approach-scores.txt`); used only in `scripts/`. |
| Bug | `get_payee_total` puts the model's `name` straight into `$regex` without escaping (`tools.py:232`); `find_payments` escapes it (`tools.py:373`). A name like `"a("` returns an error, and a crafted pattern could be slow. The query is still scoped to the user. |

---

## 10. Existing reusable components

**Frontend** [V]
- `components/ui/`: `Card` (plain/warn tone), `Stat` (KPI tile), `DataTable<T>` (typed columns), `Button` (primary/secondary/ghost), `Badge`, `Avatar`, `BarRow`, `ThemeToggle`
- `components/layout/AppShell` — add new nav links to the `links` array
- `features/dashboard/`: `ChartTooltip`, `chartTheme.ts` (category→colour), `LabelsToggle`, `useHidden.ts` (legend toggling), plus `SpendTrend`, `CategoryDonut`, `CategoryTrend`, `SpendHeatmap`, `ClockPanel`, `PayeeTable`, `TransferTrend`, `MobileSpend`
- `features/statements/StatementUpload` — block and inline variants
- `features/ask/TracePanel` — tool-trace viewer, can be reused for any AI feature
- `lib/format.ts`, `lib/cn.ts`, `api/client.ts` (`errorMessage`), `api/queries.ts` (key registry)

**Backend** [V]
- `api/deps.get_current_user` — the auth dependency for every new router
- `core/errors` (`AppError`, `NotFound`, `Conflict`, `Unauthorized`)
- `analytics_service._with_category()` — the classification pipeline stage
- `tools.py` registry pattern (schema + handler + `run_tool` dispatch) — add tools here
- `agent_service.ask` loop with step tracing
- `llm.complete_json` / `chat_with_tools`
- `import_service._insert_new_only` — idempotent bulk insert

---

## 11. Technical debt and risks

Ranked by impact on Outflow 2.0's "trustworthy numbers" goal.

| # | Risk | Evidence | Severity |
|---|---|---|---|
| **R1** | Transactions not linked to statements; `statement_id` silently dropped. 52 transactions have no statement record at all. Reconciliation and "undo import" are impossible for existing data. | `import_service.py:63` vs `models.py` Transaction; DB: 0/1,073 | **High** |
| **R2** | "Spending" includes transfers to people, which conflicts with the blueprint rule. Changing it changes every historical number on the dashboard and in Ask. | `analytics_service.py:9-13, 129` | **High — decision needed** |
| **R3** | No refunds/reversals. Merchant refunds and repaid loans show as income; classification is per payee only. The ₹2,000 fallback makes past totals change when labels change. | §7 | High |
| **R4** | No payee normalisation; 7 case-variant duplicates; payee joined by exact string. | DB query | Medium |
| **R5** | Import not atomic, no file hash, no failed-row reporting, no reconciliation. | §8 | Medium |
| **R6** | **Two statement PDFs still on disk** in `paisa-api/storage/uploads/…` (Oct 28–29, from the older version), plus `file_key` on 2 statement docs. Contains email, phone, every UPI reference — contradicts the README. Gitignored, so not in the repo. | filesystem + DB | Medium (privacy) |
| **R7** | Security: `JWT_SECRET` not set → default `"change-me-in-env"` signs tokens; JWT in `localStorage`, 24h, no refresh or revocation; no login rate limit; failed-login log lines include the email; upload checks extension only and reads the whole body before the size check; invalid ObjectIds → 500. | `config.py:11`, `.env` keys, `auth_service.py:36`, `statements.py:33` | Medium (local) / High (if deployed) |
| **R8** | Payee names of private individuals are sent to Azure OpenAI with no consent setting. | `categorize_service.py`, `tools.py` | Medium |
| **R9** | **No automated tests or CI.** Any Sprint 1 change to classification can silently shift numbers. | repo | **High** |
| **R10** | `occurred_at` is naive IST stored as if it were UTC; `created_at` is real UTC. Consistent today because every `$dateToString`/`$hour` also uses UTC, but any `timezone` argument or non-IST source would shift data across day/month boundaries. | `gpay_parser.py:73`, analytics | Low now, Medium later |
| **R11** | Every analytics call re-runs `$lookup` over all of a user's transactions; the dashboard fires ~9 such queries per load; `/analytics/summary` computes all months to return one. Fine at 1k rows. | `analytics_service.py` | Low |
| **R12** | `POST /payees/categorize` run twice at once can raise DuplicateKeyError → 500 (find-then-insert). | `categorize_service.py:160-169` | Low |
| **R13** | Cleanup: dead `by_name`/`MERCHANT_WORDS`, empty `services/ask.py`, unused `App.tsx`/`App.css`, commented imports in `routes.tsx`; unused deps (motor, sentry-sdk…); naming drift (`paisa_token`, `paisa-theme`, db `paisa`; the running server still logs as `[outflow]`, so it predates the rename commit); "Six-month average" label is hardcoded; `selectedMonth` defaults to `"2026-09"`. | various | Low |
| **R14** | `paisa-web/src/api/mocks.ts` is committed and says it was "sampled from a real statement": it contains payee names and 40 UPI transaction IDs that look real. The repo has a GitHub remote; whether it is public was **not verified [A]**. | `mocks.ts` | Medium (privacy) |

---

## 12. Recommended incremental migration plan

**Principles adapted to MongoDB**
- Schema changes = add **optional** fields to Beanie models (`field: X | None = None`). Existing documents stay valid and nothing is rewritten.
- Data changes = versioned, idempotent scripts in `paisa-api/app/db/migrations/NNN_name.py` with `--dry-run`, and a `migrations` collection recording what ran. Back up first with `mongodump --db paisa`.
- **Unique indexes:** check for violations with a script *before* adding them to `models.py`, because `init_beanie` builds them at startup and will refuse to boot otherwise.
- Keep money as integer paise. Keep `txn_id` dedupe. Keep existing routes and response shapes; put new modules under new routers.
- Write tests first that pin today's numbers (golden test on the current DB snapshot), then change classification behind them.

**Before Sprint 1 — decisions you need to make**
1. **Spending definition (R2):** keep "spending incl. people" as today, or split into *Expenses* (merchants) and *Transfers out* (people), with the dashboard showing both? The blueprint wants the split.
2. **Stored PDFs (R6) and committed mock data (R14):** delete/scrub? (I did not touch them.)
3. **Accounts:** GPay statements carry `bank + account_last4` per payment, so accounts can be *derived*, but balances can't (no opening/closing balance in a GPay PDF). OK to create accounts without balances until a bank statement importer exists?

**Sprint 1 order (Financial data foundation)**
1. Test harness: `pytest` + `httpx.AsyncClient`, a throwaway Mongo database per run; golden tests for `monthly_summaries`, `category_slices`, Ask tools against fixed fixtures.
2. Fix R1 going forward: add `statement_id` to `Transaction`. Backfill: **not reliably possible** for existing rows (statements overlap; 52 have no statement). Leave them `null` and label them "legacy import".
3. Add `file_hash` + `status` to `Statement` and an index on `(user_id, imported_at)`; reject or short-circuit identical files.
4. Introduce `services/classification.py`: one function / pipeline stage producing `transaction_type ∈ {expense, transfer_out, transfer_in, income, self_transfer, refund, unknown}` per transaction, with per-transaction override fields (`type_override`, `category_override`, `source`). `_with_category()` and the tools both call it.
5. Payee normalisation: add `normalized_name` (case/whitespace/punctuation-folded) to payees; migration script merges case-variants (keeping any `source="user"` label); join on the normalised key.
6. Accounts: new `accounts` collection derived from distinct `(user_id, bank, account_last4)`; add `account_id` to transactions (backfill is deterministic here).
7. Escape regex in `get_payee_total`; return 400 for invalid ObjectIds.

---

## 13. Exact files to modify in Sprint 1

**Backend**
| File | Change |
|---|---|
| `paisa-api/app/db/models.py` | `Transaction`: `statement_id`, `account_id`, `transaction_type`, `type_override`, `category_override`, `notes`, `updated_at` (all optional). `Statement`: `file_hash`, `status`, `failed_count`, index on `user_id`. `Payee`: `normalized_name`. New `Account` doc. Register in `DOCUMENT_MODELS`. |
| `paisa-api/app/services/import_service.py` | file hash, status, account resolution, `statement_id` now persists |
| `paisa-api/app/services/gpay_parser.py` | count unparseable header rows instead of silently skipping them |
| `paisa-api/app/services/analytics_service.py` | replace inline bucketing with the classification stage; return expenses and transfers as separate fields (keep the old field names until the frontend moves) |
| `paisa-api/app/services/tools.py` | use the classification stage; escape regex; unify the payee-total definition |
| `paisa-api/app/services/categorize_service.py` | key on `normalized_name`; upsert instead of find-then-insert; remove dead `by_name` |
| `paisa-api/app/api/statements.py` | keep `/statements/transactions` as it is (backward compatible) |
| `paisa-api/app/main.py` | register new routers |
| `paisa-api/app/core/errors.py` | handle `bson.errors.InvalidId` → 400 |
| `paisa-api/requirements.txt` | add `pytest`, `pytest-asyncio` (dev); optionally remove unused deps |

**Frontend**
| File | Change |
|---|---|
| `paisa-web/src/types/api.ts` | new fields (transaction type, account) |
| `paisa-web/src/api/queries.ts` | new hooks/keys |
| `paisa-web/src/features/dashboard/DashboardPage.tsx` | only if the spending definition changes (decision 1) |
| `paisa-web/src/components/layout/AppShell.tsx` | nav link for Transactions / Accounts |
| `paisa-web/src/routes.tsx` | new routes |

---

## 14. Proposed new files and folders

```
paisa-api/
├── app/
│   ├── api/
│   │   ├── transactions.py        GET list w/ filters, GET/:id, PATCH/:id (override type/category/notes)
│   │   └── accounts.py            GET list, GET/:id, PATCH/:id (nickname)
│   ├── services/
│   │   ├── classification.py      single source of truth for transaction_type
│   │   ├── payee_normalize.py     normalize_name()
│   │   └── accounts_service.py
│   ├── schemas/
│   │   ├── transactions.py
│   │   └── accounts.py
│   └── db/migrations/
│       ├── runner.py              records applied migrations in a `migrations` collection
│       ├── 001_payee_normalized_name.py
│       ├── 002_accounts_from_transactions.py
│       └── 003_transaction_type_backfill.py
└── tests/
    ├── conftest.py                test DB, auth client, fixtures
    ├── test_import_dedupe.py      same file twice → no duplicates
    ├── test_classification.py     self-transfer, person, refund, unknown
    ├── test_analytics_golden.py   pins current month totals
    ├── test_isolation.py          user A cannot see user B
    └── test_tools.py

paisa-web/src/
├── api/transactions.ts, accounts.ts
└── features/
    ├── transactions/TransactionsPage.tsx    (uses DataTable, filters, pagination)
    └── accounts/AccountsPage.tsx
```

Later modules (budgets, recurring, goals, wealth, notifications) fit the same layout: `api/<module>.py` + `services/<module>_service.py` + `schemas/<module>.py` + `features/<module>/`. New Ask tools go in `services/tools.py` (or `services/tools/` once it grows past ~10 tools).

---

### What was not verified
- Azure deployment / model name (env value not opened).
- Whether local MongoDB runs as a replica set (needed for multi-document transactions).
- Whether the GitHub repo is public.
- Frontend runtime behaviour: no app was launched; findings come from reading code.
- `scripts/` research harnesses were skimmed, not audited line by line.
