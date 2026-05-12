import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
	return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol data-slot="breadcrumb-list" className={cn("ui-breadcrumb-list", className)} {...props} />
	);
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li data-slot="breadcrumb-item" className={cn("ui-breadcrumb-item", className)} {...props} />
	);
}

function BreadcrumbLink({
	asChild,
	className,
	...props
}: React.ComponentProps<"a"> & {
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot.Root : "a";

	return (
		<Comp data-slot="breadcrumb-link" className={cn("ui-breadcrumb-link", className)} {...props} />
	);
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		// biome-ignore lint/a11y/useFocusableInteractive: unavoidable
		// biome-ignore lint/a11y/useSemanticElements: unavoidable
		<span
			data-slot="breadcrumb-page"
			role="link"
			aria-disabled="true"
			aria-current="page"
			className={cn("ui-breadcrumb-page", className)}
			{...props}
		/>
	);
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-separator"
			role="presentation"
			aria-hidden="true"
			className={cn("ui-breadcrumb-separator", className)}
			{...props}
		>
			{children ?? <ChevronRight />}
		</li>
	);
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-ellipsis"
			role="presentation"
			aria-hidden="true"
			className={cn("ui-breadcrumb-ellipsis", className)}
			{...props}
		>
			<MoreHorizontal className="size-4" />
			<span className="sr-only">More</span>
		</span>
	);
}

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
};
