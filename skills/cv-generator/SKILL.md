---
name: cv-generator
description: Create polished, modern, personalized CVs with themes, sidebar layout options, QR code control, multilingual output, schema validation, and HTML or PDF generation through the cv-generator MCP server.
license: MIT
compatibility: Requires the local cv-generator MCP server tools to be available in Hermes or another agentskills.io-compatible client.
metadata:
  author: ClementV78
  hermes:
    tags: [cv, resume, career, pdf, html, mcp, personalization, multilingual]
    category: career
    requires_toolsets: [mcp]
    related_skills: [mcp, native-mcp]
---

# CV Generator

## When to Use
- The user wants a polished CV, resume, or job application document generated from scratch.
- The user wants a fake but realistic CV tailored to a role, location, and seniority.
- The user wants the CV customized by language, theme, QR code, export style, or sidebar position.
- The user wants to validate, repair, or regenerate a `CvData` payload before producing HTML or PDF.
- The user needs local-file generation because the `cv_data` payload is too large for a single MCP tool call.

## Procedure
1. Treat `CvData` as the source of truth.
   - Do not invent alternate field names.
   - Keep `render` inside `cv_data`.
   - Keep schema keys in English even when the visible CV is in French or Spanish.
2. Capture the render preferences before generating when they are missing and likely to change the result.
   - Ask for `language`, `theme`, `pdf style`, `QR code`, and `sidebar position`.
   - Supported languages are `english`, `french`, and `spanish`.
   - If the user already gave enough direction for a useful first version, apply defaults and state them briefly.
   - If the user gives carte blanche, default to `english`, `graphite`, `paginated`, `QR off`, and `sidebar left`.
3. Start from a valid example whenever possible.
   - Use `examples/cv-minimal.json` for a small base.
   - Use `examples/cv-devops.json` for DevOps profiles.
   - Use `examples/cv-cloud-architect.json` for cloud architecture profiles.
   - Translate and adapt the example instead of leaving mixed-language content.
4. Build or locate the payload as native JSON.
   - Prefer `cv_data_path` when the JSON already exists on disk or is too large for a direct tool call.
   - Use direct MCP calls with a valid `cv_data` object only for small payloads.
   - Do not assemble the payload through `exec`, Python glue, or stringified JSON literals.
   - Keep `experiences[].projects` as an array even when empty.
   - For a local profile photo, use `header.photoPath` instead of embedding raw base64 in `header.photoUrl`.
5. Validate before generating.
   - Call `mcp_cv_generator_get_cv_schema` if the structure is uncertain.
   - Call `mcp_cv_generator_validate_cv` with the same source (`cv_data` or `cv_data_path`) that will be used for generation.
   - Fix the payload rather than working around the tool response.
6. Generate the requested artifact.
   - Use `mcp_cv_generator_generate_cv_html` for HTML.
   - Use `mcp_cv_generator_generate_cv_pdf` for PDF.
   - Prefer `cv_data_path` for large local payloads.
   - Use `mcp_cv_generator_start_cv_chunked_generation` followed by ordered `mcp_cv_generator_append_cv_generation_chunk` only when local file input is not available.
   - Always report the returned `file_path` for generated PDF files.

## Examples

### Example 1: Fake DevOps CV
```text
Input: Generate a realistic DevOps CV in English for New York with 4 years of experience, theme cyber, sidebar on the right.
Expected behavior: Start from the DevOps example, adapt the content to the requested profile, keep the schema valid, validate first, then generate the HTML or PDF artifact.
```

### Example 2: Preference capture
```text
Input: Create a CV for a cloud architect in Madrid.
Expected behavior: Ask for any missing material preferences such as language, theme, PDF style, QR code, and sidebar position before final generation.
```

### Example 3: Large payload handling
```text
Input: Generate a very detailed multi-project CV that exceeds the direct tool payload limit.
Expected behavior: Write or use a local JSON file in the allowed input directory and call validate/generate with cv_data_path. Use the chunked MCP workflow only if local file input is unavailable.
```

### Example 4: Local photo handling
```text
Input: Generate my CV using C:\Tmp\CV\cv-inputs\cv.json and my photo in C:\Tmp\CV\cv-assets\photo.jpg.
Expected behavior: Use cv_data_path for the JSON. Ensure the CV uses header.photoPath for the photo, not raw base64 in photoUrl, then generate and report file_path.
```

## Pitfalls
- Do not claim a QR code is disabled unless `cv_data.header.showQrCode` is explicitly `false`.
- Do not leave French section titles in English or Spanish CVs, or vice versa.
- Do not translate schema keys. Only translate visible CV content and rendered labels.
- Do not skip validation when editing examples heavily; a valid-looking payload can still violate page or structure constraints.
- Do not use `exec`, brittle scripts, or shell helpers to construct `cv_data`; this caused failures in previous Hermes runs.
- Do not force a single direct MCP call when the serialized payload is above the size limit. Prefer `cv_data_path`.
- Do not embed local photos as raw base64 when `header.photoPath` is available.
- Do not assume the generated PDF location; read and report the returned `file_path`.

## Verification
- Confirm that the final payload contains all required top-level fields: `header`, `profileLabel`, `profile`, `skillGroups`, `highlights`, `certifications`, `formations`, `languages`, `experiences`, `mainEducation`, and `render`.
- Confirm that `render.theme`, `render.sidebarPosition`, `render.maxPages`, and `render.language` are set inside `cv_data.render`.
- Confirm that labels, profile text, bullets, education, certifications, and availability text are all in the same language.
- Confirm that `mcp_cv_generator_validate_cv` succeeds before generation.
- Confirm that large local CVs use `cv_data_path` and local photos use `header.photoPath`.
- Confirm that the generated HTML or PDF path or content returned by the MCP tool matches the user-requested output format.
