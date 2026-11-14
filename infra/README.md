# Ghost Notes hosting runbook

Adapted from FireLakeLabs/order-doesnt-matter `origin/main` at `b0d9fb3`.
`GhostNotes` owns two private retained S3 buckets (website and releases),
one CloudFront distribution/OAC, response headers, A/AAAA records for
`ghostnotes.firelakelabs.com`, and two repository/environment-specific GitHub roles.
It shares only the certificate, hosted zone, GitHub OIDC provider and existing
CDK bootstrap roles by reference. No context lookups. Never rebootstrap or
modify other sites or stacks.

## First provisioning (orchestrator, after this PR merges)

The owner approved step 12 on 2026-11-13 (issue #10). This PR provides code
and read-only proof; it provisions nothing. Use Node from `.node-version`.
`mms-deploy` is a historical profile name. Use the current short-lived session,
or refresh it with `aws login --profile mms-deploy` if it has expired.
**Before deploying roles:** create `production` and `infrastructure` in
FireLakeLabs/ghost-notes Settings → Environments. For both use **Selected
branches and tags → Branch → main only**, with **no tag rules**. Verify these
restrictions even if the environments already exist. Leave `GN_DEPLOY_ENABLED`
unset. This closes the gap where roles could trust an unrestricted environment.
The workflow gate prevents accidental entry; a repository writer can edit that
gate, so it is not a security control against writers.

Then, from an up-to-date checkout of main:

```bash
export AWS_PROFILE=mms-deploy
npm ci
npm run check
npm run test:browser
python3 -m unittest discover -s tools/audio-to-midi -p 'test_*.py'
cd infra
npm ci
npm test
node scripts/check-cdk-access.mts
npx cdk synth GhostNotes --strict --quiet
npx cdk diff GhostNotes --no-change-set
# Review the diff and resource list before continuing (orchestrator only).
npx cdk deploy GhostNotes --require-approval broadening --outputs-file outputs.json
cat outputs.json
```

Before deployment, confirm the referenced certificate still covers the hostname
and zone ownership is correct. Issue #10 records the previous read-only checks:
certificate issued, wildcard coverage, expiry 2027-01-24, no hostname records
and no GhostNotes stack. Compare `config.mts` against:

```bash
gh api repos/FireLakeLabs/ghost-notes/actions/oidc/customization/sub
```

The prefix must be `repo:FireLakeLabs@267435624/ghost-notes@1455957347`.
Retain the immutable subject; do not broaden trust. IAM matches that exact
prefix plus `:environment:production` or `:environment:infrastructure` and
`aud=sts.amazonaws.com`. The environment subject does not include a branch:
main-only access depends on the environment branch restrictions below as well
as the workflows' main guards ([GitHub's OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)).
The access check assumes only the three existing bootstrap roles, discards
credentials, and prints ARNs. Bootstrap infrastructure access is privileged;
it can pass the shared execution role. Only trusted administrators should approve
infrastructure changes on main. The publisher has no CloudFormation access.

## GitHub environments and variables (orchestrator only)

Leave repository variable `GN_DEPLOY_ENABLED` unset until setup is complete.
The checked-in workflows skip environment jobs until it is exactly `true`.
PRs run the offline Deploy check job only, with no environment or OIDC permission.

Confirm the environments created **before provisioning** are still restricted. For **both**, select deployment branches/tags:
**Selected branches and tags → Branch → main only**, with **no tag rules**.
An environment subject alone cannot enforce main; do this before enabling either
workflow. Set environment **variables**, not secrets:

| Environment    | Variable          | Value from `infra/outputs.json`                  |
| -------------- | ----------------- | ------------------------------------------------ |
| production     | `AWS_ROLE_ARN`    | `GhostNotes.AppDeployRoleArn`                    |
| production     | `HOSTING_OUTPUTS` | The entire JSON document, including `GhostNotes` |
| infrastructure | `AWS_ROLE_ARN`    | `GhostNotes.InfraDeployRoleArn`                  |

Refresh outputs after infrastructure changes. ARNs are configuration, not secrets.
The publisher checks stack identity, deterministic bucket names, account,
distribution ARN, alias, certificate, origin/OAC and redirects before writing.
Once the environments, branch restrictions and variables are in place, enable:

```bash
gh variable set GN_DEPLOY_ENABLED --repo FireLakeLabs/ghost-notes --body true
gh workflow run deploy.yml --repo FireLakeLabs/ghost-notes --ref main
```

Run the first publish with `rollback_release` blank. The gate runs the full app
checks, browser suite, model-free Python tests, infra tests and strict synthesis;
it retains one build artifact. Publishing downloads that exact artifact without
rebuilding. The browser suite builds a separate temporary copy. With no production
role variable, configuration succeeds and publishing is skipped. Later infrastructure
changes use the manual Infrastructure workflow on main; it shares the production
concurrency group with publishing. Coordinate any local provisioning/recovery with
all workflow publishers too.

## Hosted verification and recovery

Orchestrator checklist: valid HTTPS; HTTP redirects; anonymous S3 GET fails for
**both** buckets; homepage bytes match the retained artifact; missing assets
remain errors; JavaScript MIME/cache headers are correct; `/licenses.txt` is
readable and includes soundfonts' full AGPL text; manifest and PNG paths return
`application/manifest+json` and `image/png`. Root manifest/icons revalidate.
Only `dist/` is uploaded; reference music stays local and is never cached by
this hosting code. About must link the deployed
commit and every directly pinned Strudel package's corresponding source.
Indirect dependencies (including `@strudel/draw` in webaudio) are covered by
the deployed source, lockfile and full third-party notices. Press Play in a
fresh tab and check worker/worklet requests and sample loading. Listening requires
a person; automated checks cannot establish what was heard. Check an older tab
after a new publish. None of these hosted checks have been claimed by this PR.

Rollback: run Deploy on main with `rollback_release` set to an exact completed
archive ID (`release.json` exists), or:

```bash
gh workflow run deploy.yml --repo FireLakeLabs/ghost-notes --ref main \
  -f rollback_release=RELEASE_ID
```

Checksums precede website writes; assets precede HTML. No deletes or automatic
expiration. Retain archives/assets indefinitely; cleanup requires separate review.
For coordinated local recovery, from the root with the fresh profile:

```bash
HOSTING_OUTPUTS="$(cat infra/outputs.json)" node infra/scripts/hosting.mts rollback RELEASE_ID
```

The pinned upstream CDK tooling carries moderate minimatch advisories; the
[upstream disposition](https://github.com/FireLakeLabs/monkeyboys-modular-synth/blob/main/docs/cdk-advisory.md)
applies. No untrusted glob inputs or browser CDK dependencies are introduced.
Reassess when upgrading; no forced override is applied.
