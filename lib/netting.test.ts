/**
 * Property-based tests for the netting algorithm.
 *
 * Four invariants we assert across thousands of randomly generated balance maps:
 *   1. Conservation     — input balances sum to zero (a precondition of the test).
 *   2. Zero state       — after applying minSettlements, every balance is zero.
 *   3. Idempotency      — running settle-up twice equals running it once.
 *   4. Minimum-edges    — |settlements| <= count(non-zero balances) - 1.
 *
 * These tests are the Case 3 audit-lock pattern applied to a different domain.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { minSettlements, applySettlements, type UserId, type Amount } from "./netting";

/** Generator: a zero-sum balance map across N synthetic users. */
const balanceMapArb = (minUsers = 3, maxUsers = 8) =>
  fc.integer({ min: minUsers, max: maxUsers }).chain((n) =>
    fc
      .array(fc.integer({ min: -50000, max: 50000 }), { minLength: n, maxLength: n })
      .map((nums) => {
        // Adjust the last entry so the array sums to zero (conservation precondition).
        const sum = nums.reduce((a, b) => a + b, 0);
        nums[nums.length - 1] -= sum;
        const m = new Map<UserId, Amount>();
        nums.forEach((amt, i) => m.set(`u${i}`, amt / 100));
        return m;
      }),
  );

const countNonZero = (m: Map<UserId, Amount>): number =>
  [...m.values()].filter((v) => Math.abs(v) > 1e-9).length;

const sumOf = (m: Map<UserId, Amount>): number =>
  [...m.values()].reduce((a, b) => a + b, 0);

describe("minSettlements — property tests", () => {
  it("zero state: after settlements, every balance is zero", () => {
    fc.assert(
      fc.property(balanceMapArb(), (balances) => {
        const settlements = minSettlements(balances);
        const after = applySettlements(balances, settlements);
        for (const v of after.values()) {
          expect(Math.abs(v)).toBeLessThan(0.01); // 1-paise tolerance
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("idempotency: running settle-up twice = running it once", () => {
    fc.assert(
      fc.property(balanceMapArb(), (balances) => {
        const first = minSettlements(balances);
        const after = applySettlements(balances, first);
        const second = minSettlements(after);
        expect(second).toHaveLength(0);
      }),
      { numRuns: 1000 },
    );
  });

  it("minimum-edges: settlement count <= non-zero balance count - 1", () => {
    fc.assert(
      fc.property(balanceMapArb(), (balances) => {
        const nNonZero = countNonZero(balances);
        const settlements = minSettlements(balances);
        if (nNonZero === 0) {
          expect(settlements).toHaveLength(0);
        } else {
          expect(settlements.length).toBeLessThanOrEqual(nNonZero - 1);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("conservation: input balance sums to zero by construction", () => {
    fc.assert(
      fc.property(balanceMapArb(), (balances) => {
        expect(Math.abs(sumOf(balances))).toBeLessThan(0.01);
      }),
      { numRuns: 200 },
    );
  });

  it("all settlement amounts are positive", () => {
    fc.assert(
      fc.property(balanceMapArb(), (balances) => {
        const settlements = minSettlements(balances);
        for (const s of settlements) {
          expect(s.amount).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("minSettlements — worked examples", () => {
  it("3-person dinner: A paid ₹3000, all split equally → 2 settlements (not 3)", () => {
    // A paid 3000, owes share of 1000. Net: A=+2000, B=-1000, C=-1000
    const balances = new Map<UserId, Amount>([
      ["A", 2000],
      ["B", -1000],
      ["C", -1000],
    ]);
    const out = minSettlements(balances);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.to === "A")).toBe(true);
    const total = out.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(2000);
  });

  it("cycle reduction: A owes B owes C owes A → resolves cleanly", () => {
    // Symmetric cycle — all zero net balance
    const balances = new Map<UserId, Amount>([
      ["A", 0],
      ["B", 0],
      ["C", 0],
    ]);
    const out = minSettlements(balances);
    expect(out).toHaveLength(0);
  });

  it("simple 2-person debt: 1 settlement", () => {
    const balances = new Map<UserId, Amount>([
      ["A", 500],
      ["B", -500],
    ]);
    const out = minSettlements(balances);
    expect(out).toEqual([{ from: "B", to: "A", amount: 500 }]);
  });
});
