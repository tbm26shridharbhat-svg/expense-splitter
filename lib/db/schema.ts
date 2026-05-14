/**
 * Mongoose models — Pocket Splitter
 *
 * Architecture: event-sourced ledger on MongoDB.
 *
 * - `Event` is the immutable, append-only source of truth.
 * - `BalanceView` is a projection — computable from events at any point.
 * - `Group`, `User`, `Membership` are convenience projections / auth-facing tables.
 *
 * Every state-changing action MUST be expressed as an Event. Balances must
 * never be mutated outside of the projection updater.
 */
import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

// ---------- USERS ----------
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String },
    passwordHash: { type: String },
  },
  { timestamps: true, collection: "users" },
);

export const User = (models.User as mongoose.Model<InferSchemaType<typeof userSchema>>) ?? model("User", userSchema);
export type UserDoc = InferSchemaType<typeof userSchema>;

// ---------- GROUPS ----------
const groupSchema = new Schema(
  {
    name: { type: String, required: true },
    baseCurrency: { type: String, required: true, default: "INR" },
    isTrip: { type: Boolean, default: false },
    shareToken: { type: String, unique: true, sparse: true },
  },
  { timestamps: true, collection: "groups" },
);

export const Group = (models.Group as mongoose.Model<InferSchemaType<typeof groupSchema>>) ?? model("Group", groupSchema);
export type GroupDoc = InferSchemaType<typeof groupSchema>;

// ---------- MEMBERSHIPS ----------
const membershipSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  },
  { collection: "memberships" },
);
// One membership row per (group, user); upsert-friendly
membershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export const Membership =
  (models.Membership as mongoose.Model<InferSchemaType<typeof membershipSchema>>) ??
  model("Membership", membershipSchema);
export type MembershipDoc = InferSchemaType<typeof membershipSchema>;

// ---------- EVENTS — the source of truth ----------
//
// Event types:
//   "group_created"     | "member_added"  | "member_removed"
//   "expense_added"     | "expense_voided" | "expense_corrected"
//   "settlement_made"
//
// payload schema depends on type; validated by Zod at write-time (lib/events/payload.ts).
const eventSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    type: { type: String, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    // Client-supplied UUID — duplicate sends drop on this unique index.
    // This is what makes settle-up idempotent.
    clientEventId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "events" },
);
eventSchema.index({ groupId: 1, createdAt: 1 });

export const Event = (models.Event as mongoose.Model<InferSchemaType<typeof eventSchema>>) ?? model("Event", eventSchema);
export type EventDoc = InferSchemaType<typeof eventSchema>;

// ---------- BALANCES PROJECTION ----------
//
// Recomputable from `events`. Updated by the projection handler.
// Never mutated outside the projection updater. Sign convention:
//   positive amount = others owe this user
//   negative amount = this user owes others
const balanceViewSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 }, // stored as rupees with 2 dp precision
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "balances_view" },
);
balanceViewSchema.index({ groupId: 1, userId: 1, currency: 1 }, { unique: true });

export const BalanceView =
  (models.BalanceView as mongoose.Model<InferSchemaType<typeof balanceViewSchema>>) ??
  model("BalanceView", balanceViewSchema);
export type BalanceViewDoc = InferSchemaType<typeof balanceViewSchema>;
