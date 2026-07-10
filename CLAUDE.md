# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Bun/Turborepo monorepo with one published package and one example app:

- `packages/mikro-orm-attachments` — the actual npm package (`mikro-orm-attachments`), a MikroORM plugin adding type-safe file/image attachment support to entities (storage via flydrive, image variants, blurhash, custom converters).
- `apps/example` — an Elysia + MikroORM (Postgres/SQLite via kysely) app used to exercise the package during development. Not published.

Package manager is **Bun** (`packageManager: bun@1.3.5`), workspaces defined in root `package.json`.

## Commands

Run from repo root unless noted.

```sh
bun install                 # install all workspace deps
bun run dev                 # turbo dev — runs persistent dev tasks across workspaces
```

Inside `packages/mikro-orm-attachments`:

```sh
bun run build                # bunup build -> dist/ (esm, minified, .d.ts via tsgo)
bun run dev                   # bunup --watch
bun run version:patch|minor|major   # standard-version bump (also: `bun run version`)
bun run copy:readme            # copies root README/CHANGELOG into the package (used by the publish workflow)
```

There is currently **no test suite and no lint/check-types script** anywhere in the repo (the `apps/example` `test` script is a placeholder that exits 1; `turbo.json` declares a `check-types` task but no package implements it). Don't assume `bun test` or `bun run lint` do anything meaningful unless you add them yourself.

Publishing to npm happens via `.github/workflows/publish.yml` (manual `workflow_dispatch`), which bumps the version with `standard-version`, builds with `bunup`, and publishes `packages/mikro-orm-attachments`.

## Architecture

### Core flow: decorate → load → flush

1. **`AttachmentDecorator`** (`src/decorators/AttachmentDecorator.ts`) is generated per-app by `AttachmentSubscriber#AttachmentDecorator` (bound to that subscriber's driver/variant generics for type-safe autocompletion). It's a MikroORM `@Property()` wrapper with `type: new AttachmentType(...)`, and it stashes the per-property attachment options in a static symbol-keyed map on the entity's constructor (`ATTACHMENT_PROPS`), readable via `getAttachmentProps(entity)`.
2. **`AttachmentType`** (`src/DatabaseType.ts`) is the MikroORM `Type<Attachment, string>` responsible for DB (de)serialization — stores/reads a JSON column. `convertToJSValue` builds an `Attachment` via the internal `Attachment[ATTACHMENT_FN_LOAD]` static, already marked as "loaded" (hydrated from DB, no file to process).
3. **`AttachmentSubscriber`** (`src/subscribers/AttachmentSubscriber.ts`) is a MikroORM lifecycle subscriber with three hooks:
   - `onLoad`: attaches the resolved flydrive `Disk` onto every loaded `Attachment` property (so `.url()`, `.getStream()`, etc. work after fetch).
   - `beforeFlush`: for every changed/persisted entity, finds `Attachment` instances that are **not yet loaded** (i.e. freshly assigned via `Attachment.fromFile()`/`fromUrl()`) and runs them through an `AttachmentConverter`.
   - `afterDelete`: for every hard-deleted entity (`em.remove()` + flush), enumerates its `Attachment` properties (via `Attachment[ATTACHMENT_FN_KEYS]`) and best-effort deletes the original + all variant files from the resolved `Disk`; storage errors are logged via `console.warn` and never abort the delete.
4. **`Attachment`** (`src/Attachment.ts`) is the public-facing value object. Two construction states tracked via the `ATTACHMENT_LOADED` symbol: unprocessed (holds a raw `File`, not yet uploaded) vs. loaded (holds `AttachmentBase`/`ImageAttachment` metadata + a `Disk` reference). Most accessor methods (`url()`, `key()`, `size()`, `getBytes()`, `getStream()`, `preSignedUrl()`, variant lookups) throw via `#ensureLoaded()` until the entity has been flushed. Internal state transitions happen only through symbol-keyed methods (`ATTACHMENT_FN_SAVE`, `ATTACHMENT_FN_LOAD`, `ATTACHMENT_FN_PROCESS`) — these are the seams MikroORM/the subscriber use; application code should never touch them.
5. **`AttachmentConverter`** (`src/AttachmentConverter.ts`) does the actual work for one attachment property during flush: analyzes the file (via `file-type`), computes storage key (`folder` option supports `:propertyName` interpolation pulled from the entity, e.g. `folder: "avatars/:id"`), uploads the original to the resolved `Disk`, runs configured `metadata` extraction, and — for each configured variant — picks a converter (`BaseConverter` subclass) whose `supports()` returns true, runs `handle()`, and uploads the variant output. Populates and hands back an `AttachmentBase`/`ImageAttachment` via `converter.done(data)`.

### Extension points (all keyed off `BaseConverter`/`BaseMetadata` abstract classes in `src/converters/` and `src/metadata/`)

- **Converters** (`supports(input) -> boolean`, `handle(input) -> {buffer, mimeType, extname}`) implement per-variant transforms. Built-in: `SharpConverter` (peer dep `sharp`), `ImgkitConverter` (peer dep `imgkit`). Both are optional peer/dev deps — only import the ones you use, since these packages are not required as hard dependencies of the plugin.
- **Metadata extractors** (`metadata(input) -> TMetadata`) populate `AttachmentBase.meta`. Built-in: `SharpMetadata`, `ImgkitMetadata`.
- Each of these is exported as its own subpath export (see `exports` map in `packages/mikro-orm-attachments/package.json`) so consumers only pull in the peer dependency they actually installed.

### Generics carry the type safety

`AttachmentSubscriber<TDrivers, TVariants>` is generic over the configured driver map and global variant map; `DriversOf<S>`/`VariantsOf<S>` (in `src/typings.ts`) extract those back out so that `AttachmentDecorator`, `AttachmentPropertyOptions`, etc. can offer typed `driver`/`variants` options tied to one specific subscriber instance. When touching typings, keep this thread intact — it's what gives consumers autocomplete on `driver: "fs" | "s3"` and named variants.

### Known gap

Blurhash generation is currently commented out in `AttachmentConverter.process()` (`src/AttachmentConverter.ts`) — the `ImageAttachment.blurhash` field and `Attachment#blurhash()` accessor exist and are documented in the README, but nothing currently populates the value. Be aware of this mismatch if asked to fix or extend blurhash behavior.

Storage cleanup on delete (`afterDelete`) only fires for entities removed through MikroORM's normal delete lifecycle (`em.remove()` + flush). Soft-delete patterns (setting a `deletedAt` column via a plain update, e.g. `apps/example`'s `SoftDeletable` mixin) and raw `em.nativeDelete()`/query-builder deletes bypass entity hooks entirely — orphaned files are not cleaned up in those paths. This is an accepted limitation, not a bug.
