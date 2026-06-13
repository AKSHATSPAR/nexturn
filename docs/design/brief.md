# NexTurn Design Brief

NexTurn is a customer-first return resolution and second-life commerce platform.
The selected prototype direction is **Return Resolution Studio**: a focused flow
where a shopper can scan a returned item, understand its AI quality grade, compare
exchange/resale/donation/recycling routes, and choose the next best action with
transparent value, green credits, and trust evidence.

## Selected Concept

- Source: `docs/design/return-resolution-studio-concept.png`
- Primary customer problem: returns are slow, opaque, and hard to trust.
- Product stance: every feature must have a working prototype path and a real
  customer benefit, not just a theoretical AI claim.

## Build Principles

- The core customer path must work locally end to end.
- AI decisions must be explainable through concrete signals.
- AWS is used where it improves the prototype: serverless APIs, storage, data,
  and deployment readiness.
- Amazon integration is represented through an adapter boundary and connected
  order model so real SP-API credentials can be added later.
