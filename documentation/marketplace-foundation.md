# GameMarket — Marketplace Foundation

## Scope

This document defines the first Marketplace data model before creating the next database migration.
The model keeps game-specific fields flexible so Admin can change UI/details later without redesigning `products`.

## ERD

```text
users
  │ 1:N
  ▼
products ───────── N:1 ───────► games
  │                              │
  │ 1:N                          │ 1:N
  ▼                              ▼
product_images              game_attributes
  │                              │
  │                              │ 1:N
  │                              ▼
  │                       game_attribute_options
  │
  │ 1:N
  ▼
product_attribute_values ◄── N:1 ── game_attributes

products 1:1 product_credentials
products 1:N favorites (future)
products 1:N orders (future)
products 1:N reviews (future)
products 1:N reports (future)
```

## Core tables

### games

Stores the game catalog shown by the Marketplace.

- `id` BIGINT UNSIGNED PK
- `name` VARCHAR(100) UNIQUE
- `slug` VARCHAR(120) UNIQUE
- `description` TEXT NULL
- `image_url` VARCHAR(500) NULL
- `status` ENUM('ACTIVE','INACTIVE')
- `created_at`, `updated_at` DATETIME(3)

### game_attributes

Defines which fields a game uses. This drives future Add Product, Product Detail and Filter UI.

- `id` BIGINT UNSIGNED PK
- `game_id` BIGINT UNSIGNED FK → `games.id`
- `name` VARCHAR(100)
- `slug` VARCHAR(120)
- `type` ENUM('TEXT','NUMBER','SELECT','BOOLEAN')
- `is_required` BOOLEAN
- `is_filterable` BOOLEAN
- `status` ENUM('ACTIVE','INACTIVE')
- `sort_order` INT UNSIGNED
- `created_at`, `updated_at` DATETIME(3)
- UNIQUE `(game_id, slug)`

### game_attribute_options

Stores selectable values for attributes whose type is `SELECT`.

- `id` BIGINT UNSIGNED PK
- `game_attribute_id` BIGINT UNSIGNED FK → `game_attributes.id`
- `label` VARCHAR(100)
- `value` VARCHAR(100)
- `sort_order` INT UNSIGNED
- `status` ENUM('ACTIVE','INACTIVE')
- UNIQUE `(game_attribute_id, value)`

### products

Stores the public marketplace listing itself.

- `id` BIGINT UNSIGNED PK
- `seller_id` BIGINT UNSIGNED FK → `users.id`
- `game_id` BIGINT UNSIGNED FK → `games.id`
- `title` VARCHAR(200)
- `description` TEXT
- `price` DECIMAL(12,2)
- `status` ENUM('DRAFT','ACTIVE','PAUSED','SOLD','CANCELLED')
- `created_at`, `updated_at` DATETIME(3)
- Indexes for `(game_id, status)`, `(seller_id, status)` and price search

### product_images

Stores multiple images per product without hard-coding image1/image2/image3 columns.

- `id` BIGINT UNSIGNED PK
- `product_id` BIGINT UNSIGNED FK → `products.id`
- `image_url` VARCHAR(500)
- `sort_order` INT UNSIGNED
- `is_primary` BOOLEAN
- `created_at` DATETIME(3)

### product_attribute_values

Stores the value of each game-specific attribute for a product.

- `id` BIGINT UNSIGNED PK
- `product_id` BIGINT UNSIGNED FK → `products.id`
- `game_attribute_id` BIGINT UNSIGNED FK → `game_attributes.id`
- `value_text` VARCHAR(1000) NULL
- `value_number` DECIMAL(14,2) NULL
- `value_boolean` BOOLEAN NULL
- `created_at`, `updated_at` DATETIME(3)
- UNIQUE `(product_id, game_attribute_id)`

Application validation will ensure the value column matches the attribute type and that the attribute belongs to the product's game.

### product_credentials

Stores sensitive account-delivery information separately from public listing data.

- `product_id` BIGINT UNSIGNED PK/FK → `products.id`
- `game_username_encrypted` TEXT NULL
- `game_password_encrypted` TEXT NULL
- `email_encrypted` TEXT NULL
- `email_password_encrypted` TEXT NULL
- `created_at`, `updated_at` DATETIME(3)

Credentials must not be returned by normal Product Listing/Detail endpoints. They are intended for a later controlled post-purchase delivery flow.

## Initial game catalog

The first seed set follows the existing UI: Valorant, ROV, PUBG, Free Fire, Genshin Impact and Honkai: Star Rail.

Initial attribute definitions are:

```text
Valorant
- Rank: SELECT, required, filterable
- Account Level: NUMBER, required, filterable
- Region: SELECT, required, filterable
- Skin Count: NUMBER, required, filterable
- Agent Count: NUMBER, optional, filterable
- Battle Pass: SELECT, optional, filterable

ROV
- Rank: SELECT, required, filterable
- Hero Count: NUMBER, required, filterable
- Skin Count: NUMBER, required, filterable
- Server: SELECT, required, filterable
- Account Level: NUMBER, optional, filterable
- Arcana Level: NUMBER, optional, filterable

PUBG
- Rank: SELECT, required, filterable
- Account Level: NUMBER, required, filterable
- Region: SELECT, required, filterable
- Skin Count: NUMBER, required, filterable
- Weapon Skin Count: NUMBER, optional, filterable
- Outfit Count: NUMBER, optional, filterable

Free Fire
- Rank: SELECT, required, filterable
- Account Level: NUMBER, required, filterable
- Region: SELECT, required, filterable
- Skin Count: NUMBER, required, filterable
- Character Count: NUMBER, optional, filterable
- Weapon Skin Count: NUMBER, optional, filterable
```

```text
Genshin Impact
- Adventure Rank: NUMBER, required, filterable
- Server: SELECT, required, filterable
- 5-Star Character Count: NUMBER, required, filterable
- 5-Star Weapon Count: NUMBER, optional, filterable
- Character Count: NUMBER, optional, filterable
- Primogem Count: NUMBER, optional, not filterable
- Spiral Abyss Progress: SELECT, optional, filterable

Honkai: Star Rail
- Trailblaze Level: NUMBER, required, filterable
- Server: SELECT, required, filterable
- 5-Star Character Count: NUMBER, required, filterable
- 5-Star Light Cone Count: NUMBER, optional, filterable
- Character Count: NUMBER, optional, filterable
- Stellar Jade Count: NUMBER, optional, not filterable
- Memory of Chaos Progress: SELECT, optional, filterable
```

## Status strategy

Game and attribute records use `ACTIVE/INACTIVE` rather than hard deletion so historical products can retain their original data.
A product uses `DRAFT/ACTIVE/PAUSED/SOLD/CANCELLED` to control its marketplace lifecycle.
