import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface AuthFormFieldProps {
	id: string;
	name: string;
	type?: "text" | "email" | "password";
	label: string;
	placeholder?: string;
	value?: string;
	error?: string;
	disabled?: boolean;
	required?: boolean;
	autoComplete?: string;
	description?: string;
	showPasswordToggle?: boolean;
	className?: string;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
	(
		{
			id,
			name,
			type = "text",
			label,
			placeholder,
			value,
			error,
			disabled = false,
			required = false,
			autoComplete,
			description,
			showPasswordToggle = false,
			className,
			onChange,
			onBlur,
			...props
		},
		ref,
	) => {
		const [showPassword, setShowPassword] = useState(false);
		const [isFocused, setIsFocused] = useState(false);

		const isPassword = type === "password";
		const inputType = isPassword && showPassword ? "text" : type;
		const hasError = !!error;
		const isValid = !hasError && value && value.length > 0;

		const handleFocus = () => setIsFocused(true);
		const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
			setIsFocused(false);
			onBlur?.(e);
		};

		return (
			<div className={cn("space-y-2", className)}>
				<Label
					htmlFor={id}
					className={cn(
						"text-sm font-medium",
						hasError && "text-red-600",
						disabled && "text-muted-foreground",
					)}
				>
					{label}
					{required && (
						// biome-ignore lint/a11y/useAriaPropsSupportedByRole: unavoidable
						<span className="text-red-500 ml-1" aria-label="required">
							*
						</span>
					)}
				</Label>

				<div className="relative">
					<Input
						ref={ref}
						id={id}
						name={name}
						type={inputType}
						placeholder={placeholder}
						value={value}
						disabled={disabled}
						required={required}
						autoComplete={autoComplete}
						onChange={onChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						className={cn(
							"pr-10",
							hasError && "border-red-500 focus:border-red-500 focus:ring-red-500",
							isValid && "border-green-500",
							(isPassword || hasError || isValid) && "pr-10",
						)}
						aria-invalid={hasError}
						aria-describedby={error ? `${id}-error` : description ? `${id}-description` : undefined}
						{...props}
					/>

					{/* Status icons and password toggle */}
					<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
						{/* Validation status icon */}
						{!isPassword && !isFocused && (
							<>
								{hasError && <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />}
								{isValid && <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />}
							</>
						)}

						{/* Password toggle */}
						{isPassword && showPasswordToggle && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-auto p-0 hover:bg-transparent"
								onClick={() => setShowPassword(!showPassword)}
								disabled={disabled}
								aria-label={showPassword ? "Hide password" : "Show password"}
								tabIndex={-1}
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4 text-muted-foreground" />
								) : (
									<Eye className="h-4 w-4 text-muted-foreground" />
								)}
							</Button>
						)}
					</div>
				</div>

				{/* Description text */}
				{description && !error && (
					<p id={`${id}-description`} className="text-xs text-muted-foreground">
						{description}
					</p>
				)}

				{/* Error message */}
				{error && (
					<p
						id={`${id}-error`}
						className="text-xs text-red-600 flex items-center space-x-1"
						role="alert"
						aria-live="polite"
					>
						<AlertCircle className="h-3 w-3 flex-shrink-0" />
						<span>{error}</span>
					</p>
				)}
			</div>
		);
	},
);

AuthFormField.displayName = "AuthFormField";
