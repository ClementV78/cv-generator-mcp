# CvData Contract Notes

This reference is intentionally short. It is a working checklist for the `cv-generator` skill.

## Required Fields

Top-level:
- `header`
- `profileLabel`
- `profile`
- `skillGroups`
- `highlights`
- `certifications`
- `formations`
- `languages`
- `experiences`
- `mainEducation`
- `render`

## Render Fields

`render` must contain:
- `mode`
- `maxPages`
- `theme`
- `sidebarPosition`
- `language`
- `templateStyle`
- `showSkillLevels`

Valid `theme` values:
- `ocean`
- `zen`
- `zen-cream`
- `zen-orange`
- `claude`
- `graphite`
- `cyber`
- `cyber-purple`

Valid `sidebarPosition` values:
- `left`
- `right`

Valid `templateStyle` values:
- `classic`
- `compact`
- `ultra-compact`

## Local Files

For large local CVs:
- prefer `cv_data_path` over inline `cv_data`
- the path must be readable by the MCP server process
- on Windows, use Windows paths

For local photos:
- prefer `header.photoPath`
- keep `header.showPhoto: true`
- leave `header.photoUrl` empty unless a remote URL or data URL is intentionally used

For generated PDFs:
- read and report the returned `file_path`

## Example Starting Points

- Minimal fixture: `examples/cv-minimal.json`
- Cloud architect example: `examples/cv-cloud-architect.json`

## Tool Sequence

1. `mcp_cv_generator_get_cv_schema` if the structure is uncertain
2. `mcp_cv_generator_validate_cv` on the finished payload or `cv_data_path`
3. `mcp_cv_generator_generate_cv_html` or `mcp_cv_generator_generate_cv_pdf` with the same source

If the payload is too large and local file input is unavailable:
- `mcp_cv_generator_start_cv_chunked_generation`
- `mcp_cv_generator_append_cv_generation_chunk`
