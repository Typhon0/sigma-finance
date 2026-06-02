import { Search, X } from "lucide-react";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * SearchInput — a text input with a search icon prefix and an optional
 * clear button that appears when the value is non-empty.
 *
 * Replaces the repeated `<div relative><Search/><Input/><X button/></div>`
 * pattern that was copy-pasted across 20+ list/screener components.
 */
interface SearchInputProps extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
	/** Current search value — controls clear-button visibility. */
	value: string;
	/** Fires on every keystroke. */
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	/** Custom clear handler. Defaults to firing onChange with an empty value. */
	onClear?: (() => void) | undefined;
	/** "sm" = compact icon + tighter padding. Defaults to "default". */
	size?: "default" | "sm";
	/** Extra classes for the outer `<div className="relative">` wrapper. */
	containerClassName?: string | undefined;
	/** Extra classes for the `<Search>` icon. */
	iconClassName?: string | undefined;
	/** Inline styles merged *after* the auto-computed padding styles. */
	style?: React.CSSProperties | undefined;
	/** Placeholder text shown when input is empty. */
	placeholder?: string | undefined;
	/** Additional CSS classes for the input element. */
	className?: string | undefined;
	/** Disabled state. */
	disabled?: boolean | undefined;
	/** Read-only state. */
	readOnly?: boolean | undefined;
	/** Autofocus on mount. */
	autoFocus?: boolean | undefined;
	/** Input name attribute. */
	name?: string | undefined;
	/** Unique identifier. */
	id?: string | undefined;
	/** Aria label for accessibility. */
	"aria-label"?: string | undefined;
	/** Input type. */
	type?: React.HTMLInputTypeAttribute | undefined;
	/** Maximum length. */
	maxLength?: number | undefined;
	/** Tab index. */
	tabIndex?: number | undefined;
}

const SIZE_CONFIG = {
	default: {
		padding: "2.5rem",
		iconLeft: "left-3",
		iconSize: "h-4 w-4",
		clearIconSize: "h-3.5 w-3.5",
		clearRight: "right-2",
	},
	sm: {
		padding: "2rem",
		iconLeft: "left-2.5",
		iconSize: "h-3.5 w-3.5",
		clearIconSize: "h-3 w-3",
		clearRight: "right-1.5",
	},
} as const;

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
	(
		{
			value,
			onChange,
			onClear,
			size = "default",
			containerClassName,
			iconClassName,
			className,
			style,
			...props
		},
		ref,
	) => {
		const config = SIZE_CONFIG[size];

		const handleClear =
			onClear ??
			(() => {
				onChange({
					target: { value: "" },
					currentTarget: { value: "" },
				} as React.ChangeEvent<HTMLInputElement>);
			});

		const mergedStyle: React.CSSProperties = {
			paddingLeft: config.padding,
			paddingRight: value ? config.padding : undefined,
			...style,
		};

		return (
			<div className={cn("relative", containerClassName)}>
				<Search
					className={cn(
						"pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
						config.iconLeft,
						config.iconSize,
						iconClassName,
					)}
				/>
				<Input
					ref={ref}
					value={value}
					onChange={onChange}
					className={className}
					style={mergedStyle}
					{...props}
				/>
				{value && (
					<button
						type="button"
						className={cn(
							"absolute top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
							config.clearRight,
						)}
						onClick={handleClear}
						aria-label="Clear search"
					>
						<X className={config.clearIconSize} />
					</button>
				)}
			</div>
		);
	},
);

SearchInput.displayName = "SearchInput";

export type { SearchInputProps };
export { SearchInput };
