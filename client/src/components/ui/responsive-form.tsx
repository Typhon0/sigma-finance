import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useResponsiveDashboard } from "@/hooks/use-responsive-dashboard";
import { cn } from "@/lib/utils";

interface ResponsiveFormProps {
	children: React.ReactNode;
	className?: string;
	onSubmit?: (e: React.FormEvent) => void;
}

export function ResponsiveForm({ children, className, onSubmit }: ResponsiveFormProps) {
	const [responsiveState] = useResponsiveDashboard();

	return (
		<form
			onSubmit={onSubmit}
			className={cn(
				"space-y-4",
				// Adjust spacing for mobile
				responsiveState.isMobile && "space-y-6",
				className,
			)}
		>
			{children}
		</form>
	);
}

interface ResponsiveFormFieldProps {
	label: string;
	children: React.ReactNode;
	required?: boolean;
	error?: string;
	description?: string;
	className?: string;
}

export function ResponsiveFormField({
	label,
	children,
	required,
	error,
	description,
	className,
}: ResponsiveFormFieldProps) {
	const [responsiveState] = useResponsiveDashboard();

	return (
		<div className={cn("space-y-2", className)}>
			<Label
				className={cn(
					"text-sm font-medium",
					// Larger labels on mobile for better readability
					responsiveState.isMobile && "text-base",
					required && "after:content-['*'] after:ml-0.5 after:text-red-500",
				)}
			>
				{label}
			</Label>

			<div
				className={cn(
					// Ensure proper touch targets on mobile
					responsiveState.isMobile && "[&>*]:min-h-[44px] [&>*]:touch-manipulation",
				)}
			>
				{children}
			</div>

			{description && (
				<p
					className={cn("text-muted-foreground", responsiveState.isMobile ? "text-sm" : "text-xs")}
				>
					{description}
				</p>
			)}

			{error && (
				<p className={cn("text-destructive", responsiveState.isMobile ? "text-sm" : "text-xs")}>
					{error}
				</p>
			)}
		</div>
	);
}

interface ResponsiveInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	description?: string;
}

export function ResponsiveInput({
	label,
	error,
	description,
	className,
	...props
}: ResponsiveInputProps) {
	const [responsiveState] = useResponsiveDashboard();

	const input = (
		<Input
			className={cn(
				// Larger inputs on mobile for better touch interaction
				responsiveState.isMobile && "h-11 text-base",
				error && "border-destructive focus-visible:ring-destructive",
				className,
			)}
			{...props}
		/>
	);

	if (label) {
		return (
			<ResponsiveFormField
				label={label}
				error={error}
				description={description}
				required={props.required}
			>
				{input}
			</ResponsiveFormField>
		);
	}

	return input;
}

interface ResponsiveTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
	description?: string;
}

export function ResponsiveTextarea({
	label,
	error,
	description,
	className,
	...props
}: ResponsiveTextareaProps) {
	const [responsiveState] = useResponsiveDashboard();

	const textarea = (
		<Textarea
			className={cn(
				// Better sizing on mobile
				responsiveState.isMobile && "min-h-[88px] text-base",
				error && "border-destructive focus-visible:ring-destructive",
				className,
			)}
			{...props}
		/>
	);

	if (label) {
		return (
			<ResponsiveFormField
				label={label}
				error={error}
				description={description}
				required={props.required}
			>
				{textarea}
			</ResponsiveFormField>
		);
	}

	return textarea;
}

interface ResponsiveSelectProps {
	label?: string;
	error?: string;
	description?: string;
	placeholder?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	children: React.ReactNode;
	required?: boolean;
	className?: string;
}

export function ResponsiveSelect({
	label,
	error,
	description,
	placeholder,
	value,
	onValueChange,
	children,
	required,
	className,
}: ResponsiveSelectProps) {
	const [responsiveState] = useResponsiveDashboard();

	const select = (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger
				className={cn(
					// Larger select on mobile
					responsiveState.isMobile && "h-11 text-base",
					error && "border-destructive focus-visible:ring-destructive",
					className,
				)}
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>{children}</SelectContent>
		</Select>
	);

	if (label) {
		return (
			<ResponsiveFormField
				label={label}
				error={error}
				description={description}
				required={required}
			>
				{select}
			</ResponsiveFormField>
		);
	}

	return select;
}

interface ResponsiveFormActionsProps {
	children: React.ReactNode;
	className?: string;
}

export function ResponsiveFormActions({ children, className }: ResponsiveFormActionsProps) {
	const [responsiveState] = useResponsiveDashboard();

	return (
		<div
			className={cn(
				"flex gap-3 pt-4",
				// Stack buttons on mobile for better touch targets
				responsiveState.isMobile ? "flex-col" : "flex-row justify-end",
				// Add safe area padding on mobile
				responsiveState.isMobile && "pb-safe-area-inset-bottom",
				className,
			)}
		>
			{React.Children.map(children, (child) => {
				if (React.isValidElement(child) && child.type === Button) {
					return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
						className: cn(
							(child.props as any).className,
							// Larger buttons on mobile
							responsiveState.isMobile && "h-11 text-base touch-manipulation",
						),
					});
				}
				return child;
			})}
		</div>
	);
}

// Utility component for responsive button groups
interface ResponsiveButtonGroupProps {
	children: React.ReactNode;
	className?: string;
	orientation?: "horizontal" | "vertical" | "auto";
}

export function ResponsiveButtonGroup({
	children,
	className,
	orientation = "auto",
}: ResponsiveButtonGroupProps) {
	const [responsiveState] = useResponsiveDashboard();

	const getOrientation = () => {
		if (orientation === "auto") {
			return responsiveState.isMobile ? "vertical" : "horizontal";
		}
		return orientation;
	};

	const actualOrientation = getOrientation();

	return (
		<div
			className={cn(
				"flex gap-2",
				actualOrientation === "vertical" ? "flex-col" : "flex-row",
				// Center buttons on mobile
				responsiveState.isMobile && actualOrientation === "horizontal" && "justify-center",
				className,
			)}
		>
			{React.Children.map(children, (child) => {
				if (React.isValidElement(child) && child.type === Button) {
					return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
						className: cn(
							(child.props as any).className,
							// Larger buttons on mobile
							responsiveState.isMobile && "h-11 text-base touch-manipulation",
							// Full width buttons in vertical orientation
							actualOrientation === "vertical" && "w-full",
						),
					});
				}
				return child;
			})}
		</div>
	);
}
