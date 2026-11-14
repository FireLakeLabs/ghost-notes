# Decisions: hosting (G103–G105)

The index is [decisions](../decisions.md). Hosting follows the upstream design
at `b0d9fb3`; these are the adjustments for Ghost Notes.

- **G103 (2026-11-13) Check hosting on PRs; gate both AWS workflows before
  entering environments.** Deploy also runs on pull requests, where only its
  offline check job runs, including Ghost Notes' model-free Python tests.
  Its check is named `hosting` to avoid ambiguity with the protected `check`
  from the app's Check workflow.
  `GN_DEPLOY_ENABLED=true` gates both Deploy's configuration and the manual
  Infrastructure job. The upstream manual workflow had only a main guard;
  gating it too avoids accidental environment creation before setup. This
  workflow guard is not a security boundary against writers who can edit
  workflows. Create the main-only environments before deploying the roles. Exact immutable environment
  subjects remain unchanged in shape. Main-only trust also depends on those
  environment rules, because the environment subject contains no branch.
- **G104 (2026-11-13) Serve licence notices as plain text.** The publisher
  explicitly gives `.txt` files `text/plain; charset=utf-8`, rather than the
  upstream fallback `application/octet-stream`, so visitors can read the
  required `/licenses.txt` notice in the browser with `nosniff` enabled (G8).
  The About list includes soundfonts 1.3.0 and is checked against the pinned
  Strudel dependencies; the existing licence collector includes its full text.
- **G105 (2026-11-13) Serve the install manifest as a static manifest.**
  Step 10 adds install metadata without a service worker by default. The
  publisher gives `.webmanifest` files `application/manifest+json`; root
  manifest and PNG paths revalidate like HTML, while generated hashed assets
  retain immutable caching. A fake publish/restore test covers their bytes,
  paths and response metadata. Only built `dist/` files are published; local
  reference music never enters hosting or an offline cache.
