---
project: "kids-time MVP"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Parents often struggle to decide what to do with their children after preschool/school or during the weekend. The painful moment is planning the next few days: searching the internet or asking friends for ideas is tedious and time-consuming.

The product insight is that parents do not need another long list of search results. They need concise AI-filtered activity suggestions based on concrete family constraints such as place, time, children's age, and indoor/outdoor preference, with events deliberately published by other parents acting as an additional signal.

At 100x the initial audience size, published events would need stronger quality and trust controls before influencing suggestions.

## User & Persona

Primary persona: an individual parent planning activities for their own children.

They reach for the product when they need a practical activity idea for the next few days or weekend and do not want to spend time browsing scattered sources or asking friends.

## Success Criteria

### Primary

- A logged-in parent can enter activity criteria (place, time, children's age, indoor/outdoor), receive a few concise AI-suggested activities with at most one image and a source link, accept, reject, or mark suggestions as maybe/save for later, and intentionally publish selected events read-only for other parents.
- At least 70% of AI-generated event suggestions are accepted by users.

### Secondary

- Users create at least 75% of events with AI assistance.

### Guardrails

- Private parent activity choices remain private unless the parent intentionally publishes an event.
- AI results stay concise and do not become long noisy search output.
- Suggested activities respect the user's age, time, place, and indoor/outdoor criteria.

## User Stories

### US-01: Parent gets activity suggestions

- **Given** a logged-in parent with criteria for place, time, children's age, and indoor/outdoor preference
- **When** they ask for activity suggestions
- **Then** they receive a few concise AI-filtered events they can accept, reject, mark as maybe/save for later, or intentionally publish read-only to other parents

#### Acceptance Criteria

- Suggestions are returned in concise form with at most one image and a source link per event.
- The parent can accept, reject, or mark each suggested event as maybe/save for later.
- Publishing is a separate intentional action from accepting.

## Functional Requirements

- FR-001: Parent can request AI activity suggestions using place, time, child age, and indoor/outdoor criteria. Priority: must-have
  > Socrates: Counter-argument considered: too many criteria could make the first version brittle or hard to satisfy. Resolution: kept, but the MVP is constrained to the listed criteria only: place, time, child age, and indoor/outdoor.
- FR-002: Parent can view a few concise suggested activities, each with at most one image and a source link. Priority: must-have
  > Socrates: Counter-argument considered; no counter-argument selected. Resolution: stands as written.
- FR-003: Parent can manually add event information with one image and get a short AI summary. Priority: must-have
  > Socrates: Counter-argument considered; no counter-argument selected. Resolution: stands as written.
- FR-004: Parent can browse, edit, and delete their own events. Priority: must-have
  > Socrates: Counter-argument considered; no counter-argument selected. Resolution: stands as written.
- FR-005: Parent can accept, reject, or mark an event as maybe/save for later. Priority: must-have
  > Socrates: Counter-argument considered: accept/reject may be too blunt because parents might need save/maybe/not interested states. Resolution: revised to include a third maybe/save-for-later state.
- FR-006: Parent can intentionally publish an event read-only to other parents. Priority: must-have
  > Socrates: Counter-argument considered; no counter-argument selected. Resolution: stands as written.
- FR-007: Parent can use AI to filter public events by place, time, child age, and indoor/outdoor criteria. Priority: nice-to-have
  > Socrates: Counter-argument considered; no counter-argument selected. Resolution: stands as written.

## Non-Functional Requirements

- A parent sees acknowledgement of any search, filtering, or save action within 200 ms, and continuous visible progress during any operation that takes longer than two seconds.
- Private event decisions are never visible to other parents unless the parent intentionally publishes the event.
- Suggestion results remain short enough to compare quickly: the MVP shows only a few concise proposals rather than a long search-result page.

## Business Logic

The app suggests and filters child-friendly activities by matching parent-supplied constraints against event information, then lets the parent decide privately whether to keep or publish each event.

The rule consumes user-facing inputs: place, time, children's age, indoor/outdoor preference, and event information. Its output is a concise set of activity suggestions or filtered events that fit those constraints.

The parent encounters the rule when asking for new activity suggestions and, later, when filtering public events.

## Access Control

Parents log in with an account. All logged-in parents share the same role.

Each parent can create, edit, delete, accept, reject, and publish their own events. Accepting an event does not make it visible to other parents; publishing is a separate intentional action. Other logged-in parents can view published events read-only.

## Non-Goals

- No advanced recommendation algorithms beyond criteria-based AI filtering; the MVP proves constrained discovery first.
- No import of many document formats such as PDF or DOCX; manual event entry uses event information and one image.
- No parent-to-parent communication such as private messages or chat; shared events are read-only.
- No native mobile apps for the MVP; the first product surface is a web app.

## Open Questions

None captured.
