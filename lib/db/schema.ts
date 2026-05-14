/**
 * Database schema — Pocket Splitter
 *
 * Architecture: event-sourced ledger.
 *
 * - `events` is the immutable, append-only source of truth.
 * - `balancesView` is a projection — computable from events at any point.
 * - `groups`, `users`, `memberships` are convenience projections /
 *   authentication-facing tables.
 *
 * Every state-changing action MUST be expressed as an event. Balances must
 * never be mutated outside of the projection updater.
 */
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  numeric,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ---------- USERS ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- AUTH ----------
export const loginTokens = pgTable("login_tokens", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

// ---------- GROUPS ----------
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull().default("INR"),
  isTrip: boolean("is_trip").notNull().default(false),
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// ---------- EVENTS — the source of truth ----------
//
// Event types:
//   "group_created"     | "member_added"  | "member_removed"
//   "expense_added"     | "expense_voided" | "expense_corrected"
//   "settlement_made"
//
// payload schema depends on type; validated by Zod at write-time
// (see lib/events/payload.ts).
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    payload: jsonb("payload").notNull(),
    // Client-supplied UUID — duplicate sends drop on this UNIQUE constraint.
    // This is what makes settle-up idempotent.
    clientEventId: uuid("client_event_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_group_created_idx").on(t.groupId, t.createdAt)],
);

// ---------- BALANCES PROJECTION ----------
//
// Recomputable from `events`. Updated by the same handler that writes events.
// Never mutated outside the projection updater. Sign convention:
//   positive amount  = others owe this user
//   negative amount  = this user owes others
export const balancesView = pgTable(
  "balances_view",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId, t.currency] })],
);
