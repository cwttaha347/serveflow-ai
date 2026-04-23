# Production Reliability Gap Analysis

This checkpoint reflects the current autonomous flow integration (onboarding gate, AI snapshot, decision commit, logging, and seeded data).

## Verified Improvements

- Hard profile gate is enforced with required fields (`phone`, `address`) in auth and protected routes.
- Request creation no longer requires manual address and budget entry in the customer flow.
- AI snapshot now provides estimated hours, budget floor, budget recommendation, provider ranking, and recommended mode.
- Decision endpoint enforces strict provider-profit floor before request creation.
- Audit events are created for snapshot generation and final decision commit.
- Seed command generates realistic users, providers, jobs, bids, reviews, and baseline audit entries.

## Remaining Gaps Before Production

- AI service fallback strategy is still basic; if AI is unavailable, user-facing behavior should be explicitly degraded with retry/backoff and circuit-breaker policy.
- Profit floor model is heuristic; should be calibrated with larger historical data and category-specific margin policies.
- Decision race controls are still minimal for high concurrency (auto assignment and broadcast overlap windows should be transaction-guarded).
- Provider ranking explainability should be persisted per decision with a stable schema for compliance review.
- Observability is partial; add structured logs, trace IDs, and alerting on failure paths (snapshot failure rate, decision failure rate, queue backlog).
- End-to-end automated tests are still needed for onboarding gate bypass prevention and decision flow regression coverage.

## Recommended Next Hardening Steps

1. Add transactional locking around decision commit and job fan-out logic.
2. Persist per-provider scoring breakdown in decision audit payloads.
3. Add retry budget and fallback state machine for AI-dependent endpoints.
4. Add integration tests for manual/auto/broadcast decision paths and profit floor enforcement.
5. Add monitoring dashboards and error alerts for decision and notification pipelines.
