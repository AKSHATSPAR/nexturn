# Prototype Instructions

## Permanent UI Directive

Before writing, updating, or debugging any user interface component, page, sidebar, or drawer across the NexTurn codebase, the model must read and strictly adhere to the layout hierarchy, design systems, and component tokens outlined in /DESIGN.md and /Styles.json. Every viewport modification must be cross-checked against these design files to guarantee total visual consistency, pixel-perfect layout alignment, and absolute responsive optimization across all screen sizes from mobile viewports to desktop displays.

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.
