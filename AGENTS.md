# AGENTS.md

## Project Identity

This repository contains a CV generator with three cooperating layers:

- a local **web UI** for human editing
- a **Node engine** for normalization, validation, HTML rendering, and PDF rendering
- a local **MCP server** for LLM / agent usage

The public product is centered on **engine + MCP**.
The UI must remain available and functional for local human usage.

## Source Of Truth

Before making architectural or product decisions, always align with:

- `README.md`
- `APPLICATION_ARCHITECTURE_CV_GENERATOR.md`

Local planning documents may exist for working sessions, but they are not the public source of truth.

## Core Architecture Rules

Always preserve these invariants:

- The UI is a client of the engine, not the source of truth.
- The MCP server calls the engine, never the UI.
- `CvData` is the main contract for business data.
- Themes change **visual appearance only**, never structure.
- PDF headless rendering stays **Node-side** and should remain driven by the HTML/CSS template as the visual source of truth.
- Browser-only and Node-only code must remain separated.

In practice:

- no `playwright-core` import in browser bundles
- no `fs` / `node:*` logic in UI code
- no MCP behavior implemented by simulating UI clicks

## Product Direction

Optimize for a **clean beta V1**, not an over-engineered platform.

Prefer:

- small stable APIs
- predictable behavior
- simple repo layout
- practical docs
- minimal but real tests

Avoid:

- speculative refactors
- extra abstraction layers without clear payoff
- adding packaging/distribution complexity too early
- introducing new public interfaces unless clearly necessary

## Public Surface To Protect

Treat these MCP tools as the stable public beta surface:

- `generate_cv_html`
- `generate_cv_pdf`
- `validate_cv`
- `get_cv_schema`

Treat these capabilities as part of the stable product behavior:

- HTML export from `CvData`
- PDF export with `pdf_mode: "paginated" | "continuous"`
- validation with pagination diagnostics
- support for themes and left/right sidebar

## Data Contract Rules

`CvData` remains the canonical input model.

Important rules:

- business/render settings live inside `cv_data`
- `render.theme`, `render.sidebarPosition`, and `render.maxPages` are part of `CvData`
- execution-time options such as `pdf_mode` belong to the tool call, not the CV model
- `pageCount` is computed output, never input

When changing schema, types, or normalization:

- update TypeScript types
- update JSON schema
- update examples if needed
- update tests if behavior changes

## UI Rules

The UI should remain useful for local human editing.

When modifying UI behavior:

- keep editing intuitive and direct
- keep exported HTML free of editor chrome
- keep preview and export visually aligned
- do not let theme logic alter layout structure

The UI is allowed to have human-friendly fallbacks such as browser print, but these must not replace the Node engine's headless responsibilities.

## Engine Rules

The engine must stay reusable outside the UI.

When working on engine code:

- prefer pure or mostly pure functions where practical
- normalize input before rendering or validation
- keep error shapes structured and stable
- keep HTML rendering deterministic
- keep PDF rendering isolated behind engine-facing APIs
- keep the HTML/CSS template as the primary source of visual fidelity
- treat `pdfLayout.ts` as an estimation/validation helper, not as the main visual renderer

Do not move important rendering or validation rules back into the UI.

## MCP Rules

The MCP layer is an adapter, not the place for business logic.

When changing MCP behavior:

- validate tool inputs clearly
- call the engine facade rather than deep internals
- return structured, machine-friendly responses
- keep success/error shapes consistent
- keep tool descriptions aligned with actual behavior

## Documentation Rules

Public docs should stay minimal and clean.

Public docs to preserve:

- `README.md`
- `APPLICATION_ARCHITECTURE_CV_GENERATOR.md`

If you add or change user-facing behavior, update the relevant public doc.
If you change the PDF backend or its operational assumptions, update both public docs.
If you introduce or replace a core runtime dependency, check whether its license changes publication constraints.

Do not re-introduce doc sprawl at the repo root.
If a document is only useful for local planning, keep it local and do not treat it as public documentation.

## Examples And Fixtures

The repo includes public JSON examples in `examples/`.

Use them to:

- illustrate the contract
- validate user workflows
- sanity-check public behavior

When changing behavior or schema, ensure examples remain coherent and anonymized.

## Testing Expectations

Before considering a change complete, run the smallest relevant validation set.

Minimum common checks:

```powershell
npm.cmd run build
npm.cmd test
```

For PDF-related changes:

```powershell
npm.cmd run smoke:pdf
```

If PDF behavior differs between modes, also verify:

```powershell
$env:CV_PDF_MODE="continuous"
npm.cmd run smoke:pdf
```

For MCP-related changes:

```powershell
npm.cmd run mcp
```

For UI-related changes:

```powershell
npm.cmd run dev
```

## Decision Style

When multiple solutions are possible:

- choose the simplest solution that preserves architecture
- prefer extending existing engine/service paths over inventing parallel flows
- prefer small, explicit contracts over clever abstractions
- prefer readability over framework-like indirection

If a proposed change would blur the separation between UI, engine, and MCP, stop and redesign it.

## Release Mindset

This project is moving toward a public beta.

So every meaningful change should be checked against these questions:

- Does this keep the repo understandable to an external user?
- Does this preserve the public beta surface?
- Does this keep the UI useful locally?
- Does this keep engine + MCP as the real core?
- Does this avoid unnecessary complexity?

If the answer is no, revise before implementing.

