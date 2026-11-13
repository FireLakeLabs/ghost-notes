---
name: orchestrate
description: Trigger this if the user says 'orchestrate'. Runs a large body of tracked work as waves of separate threads, from one long-running thread that stays with the owner.
---

# Orchestrate

You are the long-running thread that stays with the owner (the user here). You
hold the plan and decisions. Each wave of work runs in its own thread: brief it,
follow it to a real finish, review it yourself, and land what it taught us before
the next wave. Discussing or editing this skill does not start it. Waves use
[full-send](../full-send/SKILL.md) or [full-stop](../full-stop/SKILL.md). Your own
PRs use [file-pr](../file-pr/SKILL.md) and [babysit-pr](../babysit-pr/SKILL.md).

## Approval limits

Monitoring, reviewing and reporting need no further approval. These need the
owner's own words, each time:

- **Launching a thread.** A finished wave does not start the next one.
- **Merging** your own PRs. Approving a change is not approving its merge.
- **Landing lessons and filing follow-ups** that a review proposes.
- **Granting a workflow to a wave.** Pass on what the owner said and never
  upgrade it. Without "full send", a wave stops at open PRs.

A question is a question. "Would it be safe to do X?" gets evidence, a
recommendation and "do you want me to?", not X. If an answer approves part of
what you proposed, do that part and say what you left out.

## Plan

1. Put the work on a tracking issue, with waves of child issues that carry
   acceptance criteria. Commit the evidence, because launched threads can read
   the repo but not this conversation.
2. Settle each product question before the wave that needs it, and let waves that
   need no decision go first. File undecided issues with your recommendation.
3. For anything visual, lead with a simple mockup in plain language. If an
   option's safety rests on something untested, test it before the owner chooses.
4. Record each decision in the spec that owns it, the issue and the tracking
   issue. A replaced rule stays in force, with a pointer, until its replacement
   ships.

## Launch a wave

Stay out of wave implementation unless the owner asks you to do one here. First
confirm the owner said go, `main`'s required checks are green, and approved lessons
have merged. Check that each of the last wave's PRs passed the project's full
checks on the reviewed head before merging: the commands `AGENTS.md` requires before
a commit, which CI also runs. Read every failure; a test the docs record as flaky
still needs its failure read, not assumed. Investigate failures and resolve a
confirmed product regression before continuing. Keep responsibility for pending
results after the next launch. Waves that run browser checks locally run one at a
time, because parallel suites disturb each other's timing.

Start each wave in its own branch and worktree from the latest `origin/main`. In
T3 Code, use `t3_thread_launch` with a `workspaceStrategy` of `type: "worktree"`,
`baseRef: "main"`, `startFromOrigin: true` and a named branch. Elsewhere, run
`git fetch` and `git worktree add -b <branch> <path> origin/main`, then start a
new agent session in that worktree with the harness's background-agent tool if it
has one, or give the owner the brief to start it. The new session has no
history, so the brief must stand alone:

```text
<Owner's words, like "Full send"> on <wave> of tracking issue #N in <owner/repo>:
#a, #b. The owner explicitly asked for this, so follow
.agents/skills/<skill>/SKILL.md for every PR. Read AGENTS.md first.

Goal: the outcome, and what to read for acceptance criteria.
Suggested grouping: PR by PR, with reasons. Adjust if the code suggests better.
Owner decisions: settled, so do not reopen. Say where each is recorded. Ask about
  a new product decision with the question tool, simple mockup first. Decide
  smaller things yourself and list them.
Reviewer: <owner's explicit reviewer choice, otherwise project review policy>.
Where to be careful: risky areas, invariants, what went wrong here before.
Process: pointers to the docs holding our lessons, one line per costly one.
Done means: each PR through its gate, issues closed, specs updated, replaced rules
  removed. Report PR links, merge commits, proof, decisions made for the owner,
  follow-ups filed on #N, and anything harder than expected.
```

Repeat costly lessons even when the docs hold them: one wave caught the known
failure its brief warned about and repeated the one it did not. Tell the owner
that any question waits in the wave thread, where your watch cannot see it.

## Monitor

A wave can pause between runs, so a finished run is not a finished wave. The
finish line is every wave issue closed. In T3 Code, `t3_thread_wait` returns when
a run ends, so it cannot span a wave: watch with one low-rate background command,
with the background timeout at the two-hour maximum, and call `t3_background_wait`
with its task ID. Elsewhere, run the same command in the background under the
harness's monitor tool (in Claude Code, Monitor), or as one long foreground
command:

```bash
set -- 174 175 176 # the wave's open issues
end=$(($(date +%s) + 6900))
while [ "$(date +%s)" -lt "$end" ]; do
  closed=0
  for n in "$@"; do
    [ "$(gh issue view "$n" --json state --jq .state 2>/dev/null)" = CLOSED ] && closed=$((closed + 1))
  done
  [ "$closed" -eq "$#" ] && { echo ALL_CLOSED; exit 0; }
  sleep 300
done
echo "STILL_OPEN closed=$closed of $#"
```

This is a narrow exception to `babysit-pr`'s no-watcher rule: it reads issues, and
the wave thread owns its PRs. On `STILL_OPEN`, confirm the wave is moving before
you re-arm: read the thread's latest items and pending questions (in T3 Code,
`t3_thread_read` and its `pendingRequestCount`; elsewhere, the session's log or
transcript), then check the worktree's commits, running suites and open PRs. If a question is pending or
nothing has moved, tell the owner. Otherwise re-arm with one line of status.

## Review the wave

Do this before calling the wave done. Check each item yourself:

- [ ] Read the final report in full, and scan every message for what it left out.
- [ ] Check claims against merged code: acceptance criteria, limits from the
      brief, specs updated, replaced rules gone.
- [ ] Check each PR's checks and reviews, and that the full checks, browser suite
      included, passed on the merged head.
- [ ] Check `main`'s CI after the last merge. Follow a pending run to its result
      while later work proceeds; investigate failures under the launch policy above.
- [ ] Find follow-ups left only in PR text, and unexplained results not tracked.
- [ ] Find leftovers: servers, held ports, dirty worktrees.
- [ ] Run the real app on merged `main` from your own checkout, on a spare port,
      once the wave has stopped. Walk the changed flows and look at screenshots.
      One review skipped this; the next found a visible flaw this way.

Take every figure from data, not memory. Report the verdict first, for an owner
who may be on a phone: what shipped, what you verified and what rests on the
thread's word, what went wrong, whether the last lessons held, and product
decisions the wave made alone. End with numbered questions and your recommendations.

## Land the lessons

Search the current docs for each candidate lesson and keep only real gaps, each
with a priority and target file. Prefer a check over a sentence where one fits:
see [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md).

Project lessons belong in `AGENTS.md` and `docs/`, not here. With approval, land
them in one small PR, file follow-ups on the tracking issue, and merge before the
next launch. Carry the new rules into the next brief. If a lesson changes the
process itself, propose a change to this skill.
