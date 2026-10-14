import { describe, it, expect } from "vitest";
import { failureLine } from "../src/logic.js";

const err = (props, message = "hub text") => Object.assign(new Error(message), props);
const words = { action: "save the session", thing: "session" };

describe("failureLine", () => {
  it("names a duplicate by code, or by the hub's text while production lags", () => {
    expect(failureLine(err({ status: 400, code: "UNIQUE_CONSTRAINT" }), words)).toBe("That session already exists.");
    expect(failureLine(err({ status: 400 }, "UNIQUE constraint failed: x.id"), words)).toBe("That session already exists.");
  });
  it("names a refusal without asking for a retry", () => {
    expect(failureLine(err({ status: 403 }), words)).toBe("You don’t have permission to save the session.");
    expect(failureLine(err({ status: 507 }), words)).toBe("The household’s storage is full — free up space first.");
  });
  it("asks a rate-limited member to wait", () => {
    expect(failureLine(err({ status: 429 }), words)).toBe("Too many tries — wait a minute and try again.");
  });
  it("splits a write that changed nothing by the caller's re-read", () => {
    expect(failureLine(null, { ...words, found: false })).toBe("This session has been removed.");
    expect(failureLine(null, { ...words, found: true })).toBe("You don’t have permission to save the session.");
    expect(failureLine(null, { ...words, found: true, guarded: true })).toBe("This session was changed by someone else — check it first.");
    expect(failureLine(null, { ...words, found: null })).toBe("Couldn’t save the session — try again.");
  });
  it("reads a 404 as removed and a 409 as changed when there is no re-read", () => {
    expect(failureLine(err({ status: 404 }), words)).toBe("This session has been removed.");
    expect(failureLine(err({ status: 409 }), words)).toBe("This session was changed by someone else — check it first.");
    expect(failureLine(err({ status: 409 }), { ...words, found: false })).toBe("This session has been removed.");
  });
  it("asks for a retry only when retrying can work", () => {
    for (const e of [err({}), err({ status: 0 }), err({ status: 500 }), err({ status: 503 }), err({ status: 400 }), new TypeError("Failed to fetch"), undefined]) {
      expect(failureLine(e, words)).toBe("Couldn’t save the session — try again.");
    }
  });
  it("keeps a line the app wrote for the user, and never shows hub or browser text", () => {
    expect(failureLine(err({ forUser: true }, "Pick a date first."), words)).toBe("Pick a date first.");
    expect(failureLine(err({ status: 500 }, "D1_ERROR: boom"), words)).not.toMatch(/D1_ERROR/);
    expect(failureLine(new TypeError("Failed to fetch"), words)).not.toMatch(/fetch/i);
  });
});
