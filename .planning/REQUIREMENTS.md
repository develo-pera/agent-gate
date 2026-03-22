# Requirements: AgentGate Dashboard

**Defined:** 2026-03-22
**Core Value:** A visually impressive, functional demo that proves AgentGate's MCP tools work end-to-end — judges must see real blockchain interactions through a polished UI within a 2-minute video.

## v1.1 Requirements

Requirements for Live Agent Activity Dashboard milestone.

### Activity Infrastructure

- [x] **INFRA-01**: Activity logging middleware captures all MCP tool calls with agent identity, tool name, parameters, result, and timestamp
- [x] **INFRA-02**: Activity logging captures all on-chain write operations from executeOrPrepare with tx hash and status
- [x] **INFRA-03**: In-memory circular buffer stores last 500 activity events as a module-level singleton
- [ ] **INFRA-04**: SSE endpoint streams new activity events to connected dashboard clients in real-time
- [x] **INFRA-05**: REST API endpoint returns list of registered agents with name, address, type, and registration date
- [x] **INFRA-06**: REST API endpoint returns activity history for a specific agent or all agents

### Dashboard UI

- [ ] **DASH-01**: Live Agent Activity page accessible from sidebar navigation
- [ ] **DASH-02**: Agent cards display each registered agent's name, address, type, and current status (active/idle)
- [ ] **DASH-03**: Live activity timeline shows chronological feed of tool calls and transactions across all agents
- [ ] **DASH-04**: Activity timeline updates in real-time via SSE without page refresh
- [ ] **DASH-05**: Agent status indicators update in real-time (active when tool call in progress, idle otherwise)

### Animated Agents

- [ ] **SPRITE-01**: Pixel-art sprite sheet with at least 2 unique agent character skins
- [ ] **SPRITE-02**: CSS `steps()` sprite animation with idle, walking, and working states per agent
- [ ] **SPRITE-03**: Agent sprites walk freely on a scene area on the dashboard page
- [ ] **SPRITE-04**: Hovering a sprite reveals agent details card (name, address, current action, status)

### Demo Mode

- [ ] **DEMO-01**: Demo mode shows seed activity data and animated agents so the dashboard isn't empty without live agents

## v2 Requirements

Deferred to future release.

### Enhanced Visuals

- **VIS-01**: Celebration animation when agent completes a transaction
- **VIS-02**: Speech bubbles showing current tool call on sprite
- **VIS-03**: Scene environment (cafe, office, blockchain-themed background)

### Analytics

- **ANLYT-01**: Per-agent statistics (total calls, success rate, most used tools)
- **ANLYT-02**: Charts showing activity over time

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent database for activity | Stateless constraint — in-memory buffer sufficient for demo |
| WebSocket server | SSE is simpler, unidirectional is enough, no custom server needed |
| Transaction detail page | Skipped for timeline — tx data visible in activity feed entries |
| Mobile responsive | Desktop demo only |
| Agent management CRUD | Agents register via MCP protocol, not UI |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Complete |
| INFRA-03 | Phase 5 | Complete |
| INFRA-04 | Phase 6 | Pending |
| INFRA-05 | Phase 6 | Complete |
| INFRA-06 | Phase 6 | Complete |
| DASH-01 | Phase 8 | Pending |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 8 | Pending |
| DASH-04 | Phase 8 | Pending |
| DASH-05 | Phase 8 | Pending |
| SPRITE-01 | Phase 7 | Pending |
| SPRITE-02 | Phase 7 | Pending |
| SPRITE-03 | Phase 7 | Pending |
| SPRITE-04 | Phase 7 | Pending |
| DEMO-01 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
