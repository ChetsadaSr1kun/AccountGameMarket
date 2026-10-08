# GameMarket — Marketplace Foundation

## Scope

This document describes the current Marketplace data model after migration
`025_remove_marketplace_attributes.sql`.

Products no longer use structured game-specific Attributes. Information such as
rank, server, level, skin count, and other account details belongs in the
seller-written `description`.

The Marketplace keeps public listing data separate from confidential delivery
credentials.

## ERD

```text
users
  │ 1:N
  ▼
products ───────── N:1 ───────► games
  │
  ├── 1:N ──► product_images
  │
  └── 1:1 ──► product_credentials

products 1:N orders
products 1:N reviews
products 1:N reports
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

Public game APIs expose active games. When a game is `INACTIVE`, products
belonging to that game are hidden from public Marketplace listing/detail and
cannot be used to create a new order. Admin views can still retain historical
visibility.

### products

Stores the Marketplace listing itself.

- `id` BIGINT UNSIGNED PK
- `seller_id` BIGINT UNSIGNED FK → `users.id`
- `game_id` BIGINT UNSIGNED FK → `games.id`
- `title` VARCHAR(200)
- `description` TEXT
- `price` DECIMAL(12,2)
- `status` ENUM('DRAFT','ACTIVE','PAUSED','SOLD','CANCELLED')
- `created_at`, `updated_at` DATETIME(3)
- Indexes support game/status, seller/status, and price queries

Game-specific details are free-form content in `description`. The application
does not create, validate, filter, or render structured Attributes.

### product_images

Stores multiple images for a product.

- `id` BIGINT UNSIGNED PK
- `product_id` BIGINT UNSIGNED FK → `products.id`
- `image_url` VARCHAR(500)
- `sort_order` INT UNSIGNED
- `is_primary` BOOLEAN
- `created_at` DATETIME(3)

### product_credentials

Stores confidential account-delivery information separately from public
listing data.

- `product_id` BIGINT UNSIGNED PK/FK → `products.id`
- `game_username_encrypted` TEXT NULL
- `game_password_encrypted` TEXT NULL
- `email_encrypted` TEXT NULL
- `email_password_encrypted` TEXT NULL
- `created_at`, `updated_at` DATETIME(3)

Credential values are encrypted before storage. Normal public Product
Listing/Detail endpoints must not return them.

A buyer can obtain credentials only through the controlled order credential
flow after the order reaches an allowed paid/completed state.

## Product input model

The Add/Edit Product flow uses:

```text
game
title
description
price
status
images
credentials
  ├─ gameUsername
  ├─ gamePassword
  ├─ email
  └─ emailPassword
```

For an `ACTIVE` product, the application requires the game username and game
password. Email credentials remain optional.

## Initial game catalog

The initial catalog contains:

- Valorant
- ROV
- PUBG
- Free Fire
- Genshin Impact
- Honkai: Star Rail

There are no per-game Attribute definitions. Sellers include account-specific
details directly in the product description.

## Removed Attribute model

Migration `025_remove_marketplace_attributes.sql` permanently removed:

```text
game_attributes
game_attribute_options
product_attribute_values
```

The corresponding Product API logic, Game Attributes endpoint, Admin Product
Attribute queries, frontend Attribute UI, and integration-test fixtures were
also removed.

Historical migration `005_marketplace_foundation.sql` is intentionally left
unchanged because it records how the original database was created. New
databases apply migration 005 first and migration 025 later to arrive at the
current schema.

## Status strategy

Games use `ACTIVE/INACTIVE`. Products use
`DRAFT/ACTIVE/PAUSED/SOLD/CANCELLED` for their Marketplace lifecycle.
