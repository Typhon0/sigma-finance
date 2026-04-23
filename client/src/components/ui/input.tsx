import type * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Input
 *
 * Style-sensitive properties (height, padding, radius) are driven by
 * CSS variables defined in themes.css and the per-style files.
 */

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return <input type={type} data-slot="input" className={cn("ui-input", className)} {...props} />;
}

export { Input };
