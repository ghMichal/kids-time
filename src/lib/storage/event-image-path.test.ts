import { describe, expect, it } from "vitest";

import { EventImagePathError, assertOwnerPath, isOwnerPath, parseEventImagePath } from "@/lib/storage/event-image-path";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PATH_A = `${OWNER_A}/${EVENT_ID}/photo.jpg`;

describe("event-image-path ownership", () => {
  describe("isOwnerPath", () => {
    it("returns true when the path owner segment matches", () => {
      expect(isOwnerPath(PATH_A, OWNER_A)).toBe(true);
    });

    it("returns false when the path belongs to another owner", () => {
      expect(isOwnerPath(PATH_A, OWNER_B)).toBe(false);
    });
  });

  describe("assertOwnerPath", () => {
    it("throws EventImagePathError when the owner does not match", () => {
      expect(() => {
        assertOwnerPath(PATH_A, OWNER_B);
      }).toThrow(EventImagePathError);
      expect(() => {
        assertOwnerPath(PATH_A, OWNER_B);
      }).toThrow("Image path does not belong to this owner.");
    });

    it("does not throw when the owner matches", () => {
      expect(() => {
        assertOwnerPath(PATH_A, OWNER_A);
      }).not.toThrow();
    });
  });

  describe("parseEventImagePath boundaries", () => {
    it("returns null for the wrong number of path segments", () => {
      expect(parseEventImagePath(`${OWNER_A}/${EVENT_ID}`)).toBeNull();
      expect(parseEventImagePath(`${OWNER_A}/${EVENT_ID}/photo.jpg/extra`)).toBeNull();
      expect(parseEventImagePath("photo.jpg")).toBeNull();
    });

    it("returns null when the filename contains ..", () => {
      expect(parseEventImagePath(`${OWNER_A}/${EVENT_ID}/../photo.jpg`)).toBeNull();
      expect(parseEventImagePath(`${OWNER_A}/${EVENT_ID}/foo..bar.jpg`)).toBeNull();
    });

    it("treats invalid paths as not owned", () => {
      expect(isOwnerPath(`${OWNER_A}/${EVENT_ID}`, OWNER_A)).toBe(false);
      expect(isOwnerPath(`${OWNER_A}/${EVENT_ID}/foo..bar.jpg`, OWNER_A)).toBe(false);
    });
  });
});
