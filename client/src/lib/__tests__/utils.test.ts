import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
	it("keeps text-micro when merged with a text colour", () => {
		// tailwind-merge does not know the custom `text-micro` size: without the
		// extendTailwindMerge registration in utils.ts it classifies the unknown
		// `text-*` as a colour and silently drops it next to `text-loss`, so the
		// element renders at the inherited size (the "zoomed badge" bug the
		// concentration badge hit).
		expect(cn("px-2 text-micro", "text-loss")).toBe("px-2 text-micro text-loss");
	});

	it("still resolves conflicting font sizes in favour of the last class", () => {
		expect(cn("text-xs", "text-micro")).toBe("text-micro");
		expect(cn("text-micro", "text-xs")).toBe("text-xs");
	});
});
