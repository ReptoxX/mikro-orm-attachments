# mikro-orm-attachments

`mikro-orm-attachments` is a plugin for [MikroORM](https://mikro-orm.io/) that adds powerful, type-safe file and image attachment support to your entities. It supports variants (transforms, thumbnails, etc), blurhash, custom storage drivers (via [flydrive](https://github.com/flydrive/core)), and declarative attachment columns.

---

## Features

-   📂 Attach files and images to MikroORM entities
-   🖼 Supports variants (e.g., thumbnails, webp, custom transforms)
-   🤏 Generates blurhash for fast image previews
-   💾 Storage abstraction via Flydrive (local, S3, etc.)
-   🔄 Custom converters and pipeline transforms
-   🔥 TypeScript-first & type-safe

---

## Installation

```sh
npm install mikro-orm-attachments flydrive
# If you want blurhash & image variants:
npm install sharp blurhash
```

---

## Quick Start

### 1. Create the Attachment-Service (Mikro-ORM Subscriber)

```ts
import { AttachmentSubscriber } from "mikro-orm-attachments";

const attachmentSubscriber = new AttachmentSubscriber({
	drivers: {
		fs: new FSDriver({
			location: "./uploads",
			urlBuilder: {
				async generateURL(key, filePath) {
					return `http://localhost:3000/uploads/${key}`;
				},
			},
		}),
	},
	defaultDriver: "fs",
});

export const AttachmentProperty = attachmentSubscriber.AttachmentDecorator;
```

### 2. Define an Entity with an Attachment

```ts
import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Attachment } from "mikro-orm-attachments";
import { AttachmentProperty } from "./attachmentSubscriber";

@Entity()
export class Project {
	@PrimaryKey()
	id!: number;

	@Property()
	name!: string;

	@AttachmentProperty()
	avatar!: Attachment;
}
```

### 3. Use the subscriber in your MikroORM Config

In your MikroORM config:

```ts
import { MikroORM } from "@mikro-orm/core";
import { attachmentSubscriber } from "./attachmentSubscriber";

const orm = await MikroORM.init({
	// ... your config,
	subscribers: [attachmentSubscriber],
});
```

---

## Usage

### Attaching a File

You can set entity attachments by assigning a File-like object:

```ts
import { Attachment } from "mikro-orm-attachments";

const project = orm.em.create(Project, {
	name: "My App",
	avatar: Attachment.fromFile(fileStream),
});
await orm.em.persist(project).flush(); // flush before using. Image gets uploaded and resized in this step.

// avatar column will be persisted: includes URL, size, variants, etc.
```

### Accessing Attachment Metadata

```ts
console.log(project.avatar.url()); // download URL (from urlBuilder)
console.log(project.avatar.getStream()); // File-Stream
```

### Deleting Attachments

When you hard-delete an entity (`em.remove(entity)` + `em.flush()`), the plugin automatically deletes
the attachment's underlying files (the original + every generated variant) from storage. This is
best-effort: if a storage delete fails (network error, permissions, etc.), it's logged as a warning
and the entity delete still completes — a storage error will never roll back your transaction.

**Limitation:** this only works for entities removed through MikroORM's normal delete lifecycle.
Soft-delete patterns (setting a `deletedAt` column instead of calling `em.remove()`) and raw
`em.nativeDelete()` / query-builder deletes bypass entity hooks and will **not** trigger file
cleanup — you're responsible for cleaning up storage yourself in those cases.

---

## Advanced Features

### Variants

Variants allow you to automatically create different versions of an attachment (thumbnails, webp, etc):

**Example:**

```ts
@AttachmentProperty({
  driver: "fs",
  variants: {
    thumbnail: {
      format: "jpeg",
      resize: { width: 64, height: 64 }
    },
    webp: {
      format: "webp",
      options: { quality: 70 }
    }
  }
})
avatar!: Attachment<"thumbnail" | "webp">;
```

The plugin will generate and persist all declared variants.
Adding the variant names to the Attachment Generic Type gives you and your team better DX by adding the variants to all Attachment functions
```ts
console.log(project.avatar.url("thumbnail"))
//                                  ^ -- typed, when added manually
```

You can also define global variants, that can be reused inside a single entity.

```ts
export const attachmentSubscriber = new AttachmentSubscriber({
	// ... your config
	variants: {
		thumbnail: {
			resize: {
				height: 100,
			},
			format: {
				format: "webp",
				options: {
					quality: 80,
				},
			},
		},
	},
});
```

To now use this predefined variant, you'll have to add this to your entities config.

```ts
@AttachmentProperty({
	variants: ["thumbnail"]
})
avatar!: Attachment<"thumbnail">;
```

This will automatically apply the global defined rules to this field.

### Blurhash

Fast low-quality image previews are automatically enabled. Read more at [Blurhash](https://blurha.sh).
You can also disable it for your fields.

```ts
@AttachmentProperty({
  blurhash: false, // or set BlurhashOptions
})
avatar!: Attachment;
```

Resulting attachments will include a `.blurhash()` function, that returns the corresponding blurhash string.

---

## API Reference

### `AttachmentProperty(options)`

Decorator for MikroORM entity properties.

**Options:**

-   `driver`: Optionally select which configured storage to use (`"fs"`, `"s3"`, etc.)
-   `folder`: Folder/name prefix for storage
-   `blurhash`: Enable/disable or configure [Blurhash](https://blurha.sh)
-   `variants`: Object or array of variant specs (resize, format, etc.)

### Attachment Object

Stored in the DB as JSON:

```ts
{
  name: string;
  extname: string;
  size: number;
  drive: string;
  mimeType: string;
  path: string;
  url: string;
  originalName: string;
  blurhash?: string;
  variants: Attachment[];
}
```

---

## Migration

When adding a new attachment column:

1. Add the property using `@AttachmentProperty`.
2. Add a JSON or JSONB column to your DB schema.

### Regenerating variants for existing rows

If you change a property's `variants` config (resize dimensions, format, add/remove a variant) after rows already have attachments, existing rows keep whatever was generated under the *old* config until you regenerate them:

```ts
const project = await em.findOneOrFail(Project, { id });
await attachmentSubscriber.regenerateVariants(project, "avatar");
await em.persist(project).flush();
```

This re-runs variant generation against the **current** `variants` config. It never re-uploads or touches the original file - only variants are (re)created. A variant is only regenerated if its config actually changed since it was last generated; unaffected variants are left completely untouched (no re-upload, no write). Notes:

-   **First run after upgrading** always regenerates every declared variant once per row, since older rows have no record of what config produced them - expected, not a bug. From then on, unaffected variants are skipped.
-   `entity[propertyName]` must already be loaded (fetched via the `EntityManager`, or previously flushed) - the method throws otherwise.
-   Options (all optional):
    -   `only`: string[] - restrict regeneration to just these variant names.
    -   `force`: boolean - regenerate even if the stored config already matches.
    -   `deleteOrphaned`: boolean (default `false`) - delete storage objects for variants no longer present in the config. Off by default so nothing is ever silently deleted.
-   Batch example over an entire table:

```ts
for await (const project of em.findAll(Project, { batchSize: 100 })) {
	await attachmentSubscriber.regenerateVariants(project, "avatar");
	await em.flush();
}
```

---

## FAQ

**Q: How do I upload files in HTTP requests?**

A: Accept file uploads in your framework, parse as a buffer; pass to your entity's attachment property before persist.

**Q: Can I use S3?**

A: Yes! Configure an S3 driver in `drivers` with flydrive.

**Q: Is it type-safe?**

A: Yes! Variants are type-safe and can be passed through by typing the generic `Attachment` Type to provide better DX.

---

## Credits

Created by [@ReptoxX](https://github.com/reptoxx) and contributors.

---
