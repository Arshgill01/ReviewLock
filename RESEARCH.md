# RESEARCH.md

Research date: 2026-05-23.

## Product Evidence

### r/ModSupport anchor

URL: `https://www.reddit.com/r/ModSupport/comments/1tc7fzt/suggestion_allow_mods_to_mark_posts_as_not/`

Observed facts:

- Posted on 2026-05-09.
- About 90 upvotes when checked.
- The request asks for mods to mark reviewed posts as "not reportable" or equivalent after approval.
- The OP notes native ignore reports exists, but the team problem is forgetting to use it and lacking tracking in larger teams.
- Top replies raise edit-after-approval abuse:
  - Concern: users could edit after mod approval.
  - Condition: support only while the content has not been edited since approval.
- OP accepts that fully removing reporting is not ideal because future reports can contain valid context.

Product conclusion:

- The winning feature is not ignore reports. It is "reviewed until edited."
- ReviewLock should suppress repeat reports only while the reviewed content fingerprint remains unchanged.
- Dashboard metrics must show the value of avoided churn and reopened edits.

### Flag App collision

URL: `https://developers.reddit.com/apps/flag-app`

Observed facts:

- Flag App offers report/flag workflows and freeform report filtering.
- The ModSupport OP mentions a related wishlist for Flag App.

Product conclusion:

- Do not pitch ReviewLock as a report filtering app.
- Do not compete with Flag App on trusted-user flagging or freeform report rules.
- Stay focused on the integrity-bound lock ledger: reviewed content is locked only until it changes.

## Devvit Research

### Official docs

- Triggers: `https://developers.reddit.com/docs/capabilities/server/triggers`
- Reddit API overview: `https://developers.reddit.com/docs/capabilities/server/reddit-api`
- Redis: `https://developers.reddit.com/docs/redis`
- Scheduler: `https://developers.reddit.com/docs/capabilities/server/scheduler`
- Devvit Web configuration: `https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration`
- Post model: `https://developers.reddit.com/docs/api/redditapi/models/classes/Post`
- Comment model: `https://developers.reddit.com/docs/api/redditapi/models/classes/Comment`

Official docs confirm:

- Event triggers include `onPostReport`, `onCommentReport`, `onPostUpdate`, `onCommentUpdate`, `onPostNsfwUpdate`, `onPostSpoilerUpdate`, and `onPostFlairUpdate`.
- Devvit handles Reddit API authentication through the app permission model.
- Redis is per-installation storage.
- Devvit Web uses `devvit.json` for server, post, menu, trigger, scheduler, and permission configuration.

### Local package verification

Source workspace: `/Users/arshdeepsingh/Developer/ModMirror`.

Package versions inspected:

- `devvit`: `0.12.24`
- `@devvit/web`: `0.12.24`
- `@devvit/start`: `0.12.24`

Local typings verified:

- `node_modules/@devvit/public-api/types/triggers.d.ts`
  - `PostReport`
  - `CommentReport`
  - `PostUpdate`
  - `CommentUpdate`
  - `PostNsfwUpdate`
  - `PostSpoilerUpdate`
  - `PostFlairUpdate`
- `node_modules/@devvit/reddit/models/Post.d.ts`
  - `approve()`
  - `ignoreReports()`
  - `unignoreReports()`
  - `snoozeReports(reason)`
  - `unsnoozeReports(reason)`
- `node_modules/@devvit/reddit/models/Comment.d.ts`
  - `approve()`
  - `ignoreReports()`
  - `unignoreReports()`
  - `snoozeReports(reason)`
  - `unsnoozeReports(reason)`
- `node_modules/@devvit/shared-types/schemas/config-file.v1.d.ts`
  - `menu.items`
  - `forms`
  - `triggers`
  - `permissions.redis`
  - `permissions.reddit`
- `node_modules/@devvit/public-api/apis/redis/RedisClient.d.ts`
  - string, hash, sorted set, and transaction commands.

Runtime caveats:

- Trigger delivery can be duplicated or delayed. Implement idempotency.
- Event payload fields may not be sufficient for canonical fingerprinting. Refetch target before suppressing or reopening when uncertain.
- `snoozeReports` only applies to free-form report reasons and is not core to ReviewLock.
- Do not claim live ignore/unignore behavior until playtested in the ReviewLock app.

## Codex Skill Format

Local source: `/Users/arshdeepsingh/.codex/skills/.system/skill-creator/SKILL.md`

Required skill anatomy:

- Folder name is lowercase hyphen-case.
- `SKILL.md` is required.
- `SKILL.md` requires YAML frontmatter with only `name` and `description`.
- Body is Markdown instructions.
- `agents/openai.yaml` is recommended for UI metadata.
- Validate with:

```bash
python3 /Users/arshdeepsingh/.codex/skills/.system/skill-creator/scripts/quick_validate.py <skill-folder>
```

This repository includes ReviewLock-specific skills under `.codex/skills/`.

