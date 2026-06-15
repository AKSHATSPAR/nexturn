# NexTurn Design System

## Product Feel

NexTurn must feel like a premium Amazon-adjacent commerce product: calm, trustworthy, fast to scan, and built around proof. The interface should use high contrast hierarchy, disciplined cards, crisp spacing, and restrained emerald accents that signal circular commerce without turning the whole product green.

## Visual Rules

- Use Inter for all interface typography.
- Use Lucide React icons only.
- Treat components as ShadCN-style primitives: button, input, select, card, drawer, badge, table, empty state, and toolbar.
- Use Tailwind neutral families for structure: Slate for text and Zinc/Slate for borders and backgrounds.
- Use Emerald as the only product accent.
- Keep cards at 12px radius by default. Use 16px only for major surfaces and drawers.
- Avoid purple, blue-purple, beige, decorative glows, random gradients, floating orbs, bokeh, and ornamental noise.
- Do not add arbitrary one-off CSS injections when an existing token or component class can solve the layout.
- Do not use hardcoded absolute positioning for page layout. Use grid, flex, minmax, clamp, and container constraints.

## Layout Rules

- Every screen uses a predictable shell: sidebar, top command bar, main content, footer.
- Main pages have a max readable width, generous gutters, and no content touching card borders.
- Cards must contain at least 20px internal padding on desktop and 16px on mobile.
- Text blocks must have explicit max widths. Long paragraphs should be shortened before reducing font size.
- Controls must not resize the card on hover or after loading.
- Drawers must have fixed responsive width and scroll internally.
- Tables, filters, and drawers require clear empty states.
- Marketplace cards must show image, proof/status, title, seller/location, price, and one clear action.

## Microcopy Rules

- Headers must be short and direct.
- Card titles should be 1 to 5 words.
- Buttons should be 1 or 2 words whenever possible.
- Explanatory text should be reserved for trust, AI, payment locks, and green credits.
- Do not use prototype-only authenticity wording in customer-facing UI.
- Use "Return items", "Second-life shop", "My listings", "Impact", and "Profile" as core user concepts.

## Functional Guardrails

- Visual changes must not break auth, marketplace browsing, item scan upload, AI grading, listing creation, queue join, cart saving, profile saving, dark mode, or AWS deployment.
- The marketplace remains browsable without sign-in.
- Returning, listing, queue joining, and saving require the existing auth/profile gates.
- The AI grade remains preliminary. Payment remains locked until pickup review.
- The C2C rule remains explicit: the seller keeps the item until pickup.

## Responsive Rules

- Desktop: content should feel spacious at 1280px to 1920px with no cropped sidebar text.
- Tablet: primary grids collapse before cards become cramped.
- Mobile: single-column content, sticky controls only when they do not steal vertical space, and drawers can use full width.
- No text should sit directly against a border, overflow, or wrap abruptly because of an unnecessarily narrow container.
