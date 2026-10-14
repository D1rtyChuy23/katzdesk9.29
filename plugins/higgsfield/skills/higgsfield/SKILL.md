---
name: higgsfield
description: Create images, videos, audio, voices, 3D models, ads, AI influencers and short-form content with the Higgsfield MCP connector (mcp__Higgsfield__* tools). Use when the user asks for Higgsfield, or for AI image/video generation, upscaling, reframing, background removal, lip sync/dubbing, product ads, UGC, TikTok posts, or a slash recipe like /effects, /motion, /product or /marketing-studio.
---

# Higgsfield

Higgsfield is reached through the `mcp__Higgsfield__*` tools. In Claude Code
they are deferred: load the ones you need with
`ToolSearch("select:mcp__Higgsfield__<name>,...")` before calling them. If no
Higgsfield tools exist, tell the user to connect the Higgsfield connector in
their claude.ai connector settings; do not fake results.

## 00. Before spending credits

1. Pin down the deliverable: what, how many, aspect ratio, duration, style,
   and any reference media.
2. Call `balance` when a job is large or the user mentions a budget.
3. Unsure which model fits? `models_explore` with `action: "recommend"`
   before any `generate_*` call. A model named outright → `models_explore`
   to confirm it.
4. Never generate more than asked. Browsing a catalog never authorizes
   running a preset.

## 01. Pick the tool

| Want | Tool |
| --- | --- |
| Image / video / audio | `generate_image`, `generate_video`, `generate_audio` |
| Several independent ones | `generate_*_batch`, then `jobs_wait`, then one `show_generation_by_ids` |
| Image → 3D GLB | `generate_3d` |
| Edit an existing asset | `upscale_image`, `upscale_video`, `outpaint_image`, `reframe`, `remove_background` |
| Recast one character (Kling) | `motion_control` |
| Voice clone / change / dub | `create_voice`, `voice_change`, `dubbing` |
| Effects / viral presets | `get_presets` `source: "viral"` |
| Product-shot catalog | `get_presets` `source: "marketing_studio"`, `category: "product-shot"` |
| Motion catalog | `get_presets` `category: "motion"` |
| UGC, ads, posters, marketplace | `show_marketing_studio_v2` |
| Brand / product ad runs | `ads_studio_*` (quote with `ads_studio_quote` first) |
| Genjutsu motion transfer / object swap | `generate_video` with `hf_mult_motion_control` / `hf_mult_replace_object` |
| AI influencer | `ai_influencer_prepare` → `ai_influencer_generate` |
| 3D scenes, new camera angles of a place | `get_preset_instructions` `{ preset: "/3d-jutsu" }` first |
| Shorts | `shorts_studio_*` |
| Websites / apps / games | `get_workflow_instructions` `{ workflow: "website-builder-flow" }` |
| Predict virality / hook strength | `virality_predictor` |
| Post to TikTok | `tiktok_accounts` → `tiktok_prepare_publish` → `tiktok_publish_status` |

Slash recipes (`/effects`, `/motion`, `/product`, `/marketing-studio`,
`/3d-jutsu`, ...): call `get_preset_instructions` before anything else.
Multi-step videos without a recipe: `get_workflow_instructions` (no argument)
first. Clip edits: `get_workflow_instructions` `{ workflow: "ad-multiplier" }`.
Character sheets only when explicitly asked:
`{ workflow: "character-sheet" }`.

## 02. Media in

- A local file you can read: `media_upload` → `curl -X PUT` the bytes to the
  returned URL → `media_confirm`. Use the returned `media_id`.
- A public URL: `media_import_url`.
- Neither: call `media_upload_widget` as the only tool in that turn, then
  resume after the user uploads.
- Mixed images and video: `type: "auto"`, `multiple: true`.

## 03. AI influencer rules

- `ai_influencer_get_options` for explicit traits, `ai_influencer_list_presets`
  for examples, `ai_influencer_get_settings` (with `job_id`) for an existing
  sheet.
- `ai_influencer_prepare` returns the design and price without generating.
  Preview-only requests stop here.
- Pass the prepared params unchanged to `ai_influencer_generate`, with
  `max_credits` at the quote or the user's lower budget. Keep references and
  seed; `randomize: false` for exact settings.
- Free-only: require `free_gens_remaining` > 0, `use_free_gens: true`,
  `max_credits: 0`. Never fall back to paid credits.
- Wait with `jobs_wait` (`timeout_seconds` ≤ 15). Its widget already shows the
  result; don't duplicate it.
- Afterwards offer Genjutsu animation; only after the user agrees and picks the
  sheet, open `get_presets` `source: "genjutsu"`, `category: "genjutsu"` with
  `initial_inputs.character_sheet: [{ id: job_id, type: "image_job" }]`.

## 04. Wait and show

- Poll with `jobs_wait`; never `sleep`.
- Show finished work once: `show_generation_by_ids` for batches,
  `show_result` for single results (Katana video: `action: "katana_video"`
  with `media_id` or `url`).
- Report what was made, the credits spent, and the links. On failure, say
  which job failed and why, and offer one retry, not a silent loop.

## 05. Working rules

- Confirm before anything outward-facing: publishing a website, posting to
  TikTok, entering a contest.
- Keep prompts concrete: subject, action, camera, light, style, aspect ratio.
- One change per revision; reuse the seed to compare.
- Respect the user's budget across all variants combined.
