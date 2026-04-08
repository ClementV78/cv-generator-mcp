---
name: cv-generator
description: Generate, validate, and repair realistic fake CvData payloads for the cv-generator MCP server, including schema-first workflows and chunked generation when payloads are large.
version: 1.0.0
metadata:
  hermes:
    tags: [mcp, cv, schema, generation, validation]
    related_skills: [mcp, native-mcp]
---

# CV Generator

Use this skill when the user asks to:
- create a fake but realistic CV
- validate or repair `CvData`
- generate CV HTML or PDF from the MCP server
- fix schema errors before calling the CV generator tools

## Core Rule

Treat `CvData` as the source of truth. Do not invent alternate field names.

## Package Reference

Published MCP package:

- `@xclem/cv-generator-mcp`

Direct launch:

```bash
npx -y @xclem/cv-generator-mcp
```

## Preferred Workflow

1. Start from an existing example when possible.
   - Good defaults: `examples/cv-minimal.json`
   - For a DevOps role: `examples/cv-devops.json`
   - For a cloud role: `examples/cv-cloud-architect.json`
2. Before building the final payload, ask the user for any missing visual preferences that materially affect the render:
   - CV language: `english`, `french`, or `spanish`
   - theme
   - PDF style: `paginated` or `continuous`
   - QR code: enabled or disabled
   - sidebar position: `left` or `right`
3. If the schema is uncertain, call `mcp_cv_generator_get_cv_schema`.
4. Build or edit a `cv_data` object that matches the schema exactly.
5. Validate first with `mcp_cv_generator_validate_cv`.
6. Generate only after validation succeeds:
   - `mcp_cv_generator_generate_cv_html`
   - `mcp_cv_generator_generate_cv_pdf`

## Tool Calling Discipline

- Prefer editing a nearby example object and calling the MCP tool directly with a native JSON payload.
- Do not build the payload through `exec`, ad hoc Python, or stringified JSON literals.
- Do not use Python or shell helpers just to assemble `cv_data`.
- If the payload is too large for a single call, switch to the chunked MCP workflow instead of using `exec`.
- For simple generation requests, skip unnecessary intermediate scripting.

## Preference Capture

If the user has not already specified the visual setup, ask before generation only when the missing choice is likely to change the expected result materially.

Minimum preference checklist:
- CV language: `english`, `french`, or `spanish`
- theme
- PDF style: `paginated` or `continuous`
- QR code: on or off
- sidebar position: `left` or `right`

If the user already gave enough direction for a first useful version, do not block on every missing preference. Apply defaults and state them briefly.

Language rule:
- supported CV languages are `english`, `french`, and `spanish`
- default to `english`
- if the user is clearly writing in French, English, or Spanish, use that language by default unless they ask for another one
- if the user writes in another language, default the CV content to `english` unless they explicitly choose one of the supported languages

If the user gives carte blanche, choose sensible defaults and state them briefly:
- CV language: `english`
- theme: `graphite`
- PDF style: `paginated`
- QR code: `off` unless a web version is explicitly useful
- sidebar position: `left`

If QR code is enabled for a fake CV, keep the URL fictional but coherent.

## Fake CV Content Rules

- Keep identities fictional and internally consistent.
- Use realistic but invented contact details.
- Keep experience, dates, certifications, and skills believable for the claimed seniority.
- Match the user's requested role, location, and seniority.
- If the user asks for "realistic", prefer concrete companies, projects, and tooling over vague filler.
- Keep the full CV linguistically consistent: labels, profile, bullets, education, certifications, and availability text should all use the same language.
- When starting from a French example for an English or Spanish CV, translate the content instead of leaving mixed-language sections.

## Schema Rules

- Required top-level fields: `header`, `profileLabel`, `profile`, `skillGroups`, `highlights`, `certifications`, `formations`, `languages`, `experiences`, `mainEducation`, `render`
- `render` stays inside `cv_data`
- `render.theme`, `render.sidebarPosition`, and `render.maxPages` belong in `cv_data.render`
- `pageCount` is output, never input
- Keep `skillGroups` valid:
  - `type: "bars"` uses `{ id, label, level }`
  - `type: "tags"` uses `{ id, label }`
- Keep `experiences[].projects` as an array, even when empty

## Large Payload Handling

If the serialized `cv_data` is likely above the direct-call limit, do not force a single call.

Use:
1. `mcp_cv_generator_start_cv_chunked_generation`
2. `mcp_cv_generator_append_cv_generation_chunk` in order
3. Let the final chunk trigger generation

## Repair Strategy

When a tool call fails:
- read the validation or schema error
- fix the payload, not the tool
- do not rebuild JSON via brittle Python string literals
- prefer starting from a valid example and modifying native objects or JSON files

## Good Defaults

- CV language: `english`, unless the user is clearly writing in `french` or `spanish`
- Theme: `graphite` for a professional fake CV, `ocean` for a more neutral look
- PDF style: `paginated` unless the user asks for `continuous`
- QR code: disabled unless the user asks for it or a web version is explicitly part of the deliverable
- Sidebar position: `left` unless the user asks otherwise
- `maxPages`: `2` for a compact realistic profile
- Use one clear headline, one compact profile, and two experience entries for a 5-year profile
- For a DevOps request, prefer starting from `examples/cv-devops.json`

## Output Discipline

When the user wants a CV artifact:
- return the validation result if asked for diagnosis
- otherwise return the generated HTML or PDF result from the MCP tool
- if the tool returns a file path, include it explicitly
