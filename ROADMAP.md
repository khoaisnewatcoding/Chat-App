# ChatApp Roadmap (Web + AI Mention Integration)

## 1) Project Vision

Build a real-time web chat application where people can chat in DMs and groups, with one global AI identity present in every conversation.  
The AI only responds when invoked with `@ai` anywhere in a message.

### Core Product Principles
- Human-to-human chat is first-class.
- AI is a participant, not a separate side panel.
- AI responses are explicit and controlled by invocation.
- AI context and memory are strictly limited to the current conversation.
- UX is modern chat-bubble style with profile/avatar for all senders (including AI).
- Users can collapse AI messages per conversation.

---

## 2) Locked Scope (MVP)

## Included
- Web app only.
- DM + Group conversations.
- Real-time updates via SSE.
- Global AI identity in all conversations.
- AI responds only if message contains `@ai` (case-insensitive).
- `@ai` may appear anywhere in the message.
- AI disabled state per conversation (admin-only control).
- If AI disabled: invocations silently do nothing.
- Per-user, per-conversation preference to collapse AI messages.
- English-only AI behavior.
- No AI file/image support in MVP.

## Excluded (PUNT)
- Message edit/delete.
- Multiple AI personas.
- Cross-conversation AI memory.
- AI-initiated messages.
- Voice/video.
- Mobile app.

---

## 3) Functional Requirements

## 3.1 Conversation Types
- **Direct Message (DM)**
- **Group Chat**

## 3.2 Roles and Permissions
- **Admin**
  - Can enable/disable AI for that conversation.
- **Member**
  - Can send messages and invoke AI when enabled.
- **All users**
  - Can set own AI visibility preference (collapse/expand behavior).

## 3.3 AI Invocation Rules
- Trigger when message includes `@ai` anywhere.
- Parsing is case-insensitive (`@AI` valid).
- Extract prompt from text after first `@ai`.
- If prompt empty, no AI reply (silent).
- If conversation AI disabled, no AI reply (silent).
- AI replies once per triggering message (MVP simplification).

## 3.4 AI Memory Boundaries
- AI can only read current conversation history.
- No retrieval from other conversations.
- No global user memory profile.
- Optional rolling summary stored per conversation for token control (Phase 4).

## 3.5 Message Display
- Bubble UI with sender profile/avatar.
- AI bubble rendered like other participants with global AI identity.
- If user enabled “collapse AI messages”:
  - Show collapsible placeholder for each AI message.
  - User can click to expand individual message content.

---

## 4) Non-Functional Requirements

- Real-time perceived latency for new user messages: near-instant via SSE broadcast.
- AI response latency target: acceptable within a few seconds (model-dependent).
- Scalable enough for student MVP + demo users.
- Basic security and authorization for conversation data.
- Observability: logs for AI invocation lifecycle and failures.

---

## 5) Suggested Technical Stack

- **Frontend**: Next.js (React, TypeScript)
- **Backend API**: Node.js (Express or NestJS), TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Realtime**: SSE endpoint(s)
- **Async AI Jobs**: BullMQ + Redis (or lightweight queue first)
- **AI Provider**: One LLM provider for MVP (OpenAI/Anthropic equivalent)

---

## 6) System Architecture (High Level)

1. Frontend sends message via REST.
2. Backend validates membership + stores message.
3. Backend publishes SSE event (`message.created`) to subscribers.
4. Backend checks invocation (`@ai`) + AI enabled flag.
5. If triggered, enqueue AI task.
6. AI worker builds conversation-scoped context and generates response.
7. AI response stored as normal message (`sender_type = ai`).
8. SSE broadcasts AI message event to conversation members.
9. Frontend renders/collapses AI message based on local preference.

---

## 7) Data Model (MVP Schema Plan)

## `users`
- `id` (pk)
- `email` (unique)
- `display_name`
- `avatar_url`
- `created_at`

## `conversations`
- `id` (pk)
- `type` (`dm` | `group`)
- `title` (nullable for dm)
- `ai_enabled` (boolean, default `true`)
- `created_at`

## `conversation_members`
- `conversation_id` (fk)
- `user_id` (fk)
- `role` (`admin` | `member`)
- `joined_at`
- Composite unique: (`conversation_id`, `user_id`)

## `messages`
- `id` (pk)
- `conversation_id` (fk)
- `sender_type` (`user` | `ai`)
- `sender_user_id` (nullable; null for global AI)
- `content` (text)
- `created_at`
- Optional indexes: (`conversation_id`, `created_at`)

## `user_conversation_prefs`
- `user_id` (fk)
- `conversation_id` (fk)
- `collapse_ai_messages` (boolean, default `false`)
- `updated_at`
- Composite unique: (`user_id`, `conversation_id`)

## (Optional Later) `conversation_ai_state`
- `conversation_id` (pk/fk)
- `rolling_summary` (text)
- `updated_at`

---

## 8) API Contract (MVP Endpoints)

## Auth / User
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

## Conversations
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:id`
- `GET /conversations/:id/messages?cursor=...&limit=...`

## Messages
- `POST /conversations/:id/messages`

## Preferences
- `PATCH /conversations/:id/preferences`
  - body: `{ "collapse_ai_messages": true | false }`

## Admin AI Control
- `PATCH /conversations/:id/ai-enabled`
  - body: `{ "ai_enabled": true | false }`
  - admin-only

## Realtime
- `GET /events` (SSE stream for authenticated user)

---

## 9) SSE Event Design

## Event: `message.created`
Payload:
- `conversation_id`
- `message`:
  - `id`, `sender_type`, `sender_user_id`, `content`, `created_at`
- `sender_profile`:
  - For user: user profile fields
  - For AI: global AI name/avatar metadata

## Event: `conversation.updated`
Payload:
- `conversation_id`
- changed fields (e.g., `ai_enabled`)

## Event: `preference.updated` (optional)
Payload:
- `conversation_id`
- `collapse_ai_messages`

---

## 10) AI Prompting and Safety Rules (MVP)

## System Prompt Goals
- Tone: helpful + concise.
- Language: English-only output.
- Use only conversation-provided context.
- If unsure, state uncertainty briefly.

## Guardrails
- Never reference data outside current conversation.
- Apply max context window (last N messages).
- Enforce token limits.
- Add basic content moderation check before posting AI response.

---

## 11) Parsing Spec for `@ai`

## Detection
- Case-insensitive regex match for `@ai`.
- First occurrence determines prompt extraction anchor.

## Extraction
- Prompt = substring after first `@ai`, trimmed.

## Examples
- `"can @ai summarize above?"` → `"summarize above?"`
- `"@AI give 3 bullet points"` → `"give 3 bullet points"`
- `"hello @ai"` → empty/too short => no AI reply (silent)

---

## 12) Delivery Plan (8 Weeks)

## Week 1 — Foundations
- Initialize monorepo/project structure.
- Setup DB, ORM, migrations.
- Setup auth and user model.
- Basic frontend shell and routing.

**Milestone:** Login works and app shell loads.

## Week 2 — Core Conversations
- Create DM/group models and endpoints.
- Conversation list UI.
- Membership and role checks.

**Milestone:** Users can create and open conversations.

## Week 3 — Messaging (No AI Yet)
- Implement `messages` table + APIs.
- Message list + send box + bubble UI.
- Pagination/cursor loading for history.

**Milestone:** Human chat works with stored history.

## Week 4 — SSE Realtime
- Build authenticated SSE endpoint.
- Push `message.created` to connected clients.
- Frontend EventSource subscription and live updates.

**Milestone:** Real-time chat working over SSE.

## Week 5 — AI Integration MVP
- Add global AI profile constants.
- Implement `@ai` detection and extraction.
- Add AI worker/orchestration service.
- Save AI response as normal message with `sender_type=ai`.
- Broadcast AI messages via SSE.

**Milestone:** Mention-triggered AI responses live.

## Week 6 — Permissions + Preferences
- Add admin-only `ai_enabled` controls.
- Enforce silent no-op when disabled.
- Add user preference `collapse_ai_messages`.
- Render AI collapsed placeholders in UI.

**Milestone:** Governance and user controls complete.

## Week 7 — Quality + Cost Controls
- Add context selection strategy (last N messages).
- Add optional rolling summary logic.
- Add retry/error handling for provider failures.
- Logging for invocation lifecycle.

**Milestone:** Stable behavior with predictable costs.

## Week 8 — Polish + Deployment
- UX polish (loading, empty states, tooltips for `@ai`).
- Security checks and basic rate limits.
- Deploy frontend/backend/db/redis.
- Smoke test + demo script preparation.

**Milestone:** Portfolio-ready MVP deployment.

---

## 13) Detailed Task Checklist (Execution)

## Backend
- [ ] Auth middleware and user identity context
- [ ] Conversation CRUD + membership checks
- [ ] Message create/list APIs
- [ ] SSE infrastructure + subscription management
- [ ] AI mention parser util
- [ ] AI invocation queue + worker
- [ ] Admin guard for AI enable/disable endpoint
- [ ] User preference endpoint
- [ ] Centralized error handling + structured logs

## Frontend
- [ ] Auth screens + session handling
- [ ] Conversation list and detail view
- [ ] Message bubble component with sender profiles
- [ ] EventSource client + reconnect handling
- [ ] Composer with `@ai` hint text
- [ ] Collapsed AI message component
- [ ] Per-conversation preferences UI
- [ ] Admin AI toggle UI
## Infra / Ops
- [ ] Environment variable management
- [ ] DB migration scripts
- [ ] Seed script (test users + sample rooms)
- [ ] Deployment config
- [ ] Monitoring/logging basics

---

## 14) Testing Strategy

## Unit Tests
- Mention detection and prompt extraction.
- Permission guards (admin-only AI toggle).
- Preference logic for collapsed AI messages.

## Integration Tests
- Message creation flow.
- AI trigger flow from user message to AI message persistence.
- SSE event emission correctness.

## End-to-End Smoke Tests
- User sends normal message → no AI response.
- User sends message with `@ai` in middle → AI responds.
- AI disabled room + `@ai` invocation → silent no-op.
- Collapse preference ON → AI messages shown collapsed.

---

## 15) Risks and Mitigations

## Risk: AI noise/spam
- **Mitigation:** mention-only trigger, one response per trigger, rate limits.

## Risk: Cost growth from long histories
- **Mitigation:** last N messages + rolling summary + token caps.

## Risk: Privacy leakage across conversations
- **Mitigation:** strict conversation-scoped queries and tests.

## Risk: SSE disconnect issues
- **Mitigation:** auto-reconnect and message history backfill by cursor on reconnect.

---

## 16) Post-MVP Roadmap (Phase 2+)

- File/image support for AI.
- Better prompt UX (command chips, quick actions).
- Typing indicators and read receipts.
- Message edit/delete.
- Search across messages.
- Optional multiple AI modes (still one global identity at first).

---

## 17) Definition of Done (MVP)

Project is “done” when:
1. Users can chat in DM/group with real-time SSE updates.
2. AI appears as global profile in all conversations.
3. AI replies only when `@ai` is mentioned anywhere in message.
4. AI replies are conversation-scoped in memory/context.
5. Admin can enable/disable AI per conversation.
6. Non-admin users cannot change AI room state.
7. Users can collapse AI messages per conversation.
8. AI-disabled invocation results in silent no-op.
9. App is deployed and demoable end-to-end.

---

## 18) Quick Demo Script (for portfolio/interview)

1. Create group chat with two users.
2. Send normal human messages.
3. Send: “Can @ai summarize what we decided?”
4. Show AI concise response as bubble with AI profile.
5. Toggle “collapse AI messages” for one user and show placeholder.
6. As admin, disable AI in conversation.
7. Send `@ai` invocation and show silent no-op behavior.
8. Re-enable AI and show it working again.

---

## 19) Recommended Next File to Create

After this roadmap, create:
- `PRODUCT_SPEC.md` (functional spec + edge cases)
- `API_SPEC.md` (request/response shapes + auth)
- `DB_SCHEMA.md` (ERD + SQL-level constraints)
- `SSE_EVENTS.md` (event payload contracts)

This sequence will make implementation much smoother and reduce rework.