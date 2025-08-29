import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	type PortfolioFormData,
	portfolioErrorMessages,
	portfolioFormConfig,
	portfolioValidationHelpers,
} from "@/lib/validations/portfolio.schemas";

export interface PortfolioFormFieldsProps {
	/** Existing portfolio names for validation */
	existingPortfolioNames?: string[];
	/** Current portfolio name (for edit mode) */
	currentPortfolioName?: string;
	/** Disable all fields */
	disabled?: boolean;
	/** Auto-focus name field */
	autoFocus?: boolean;
	/** Show name suggestions */
	showNameSuggestions?: boolean;
}

export function PortfolioFormFields({
	existingPortfolioNames = [],
	currentPortfolioName,
	disabled = false,
	autoFocus = true,
	showNameSuggestions = true,
}: PortfolioFormFieldsProps) {
	const form = useFormContext<PortfolioFormData>();
	const [nameValidationError, setNameValidationError] = useState<string>("");

	// Watch form values
	const watchedName = form.watch("name");

	// Validate name uniqueness
	useEffect(() => {
		if (!watchedName?.trim()) {
			setNameValidationError("");
			return;
		}

		const timeoutId = setTimeout(() => {
			const isUnique = portfolioValidationHelpers.validateNameUniqueness(
				watchedName,
				existingPortfolioNames,
				currentPortfolioName,
			);

			if (!isUnique) {
				setNameValidationError(portfolioErrorMessages.nameExists);
				form.setError("name", { message: portfolioErrorMessages.nameExists });
			} else {
				setNameValidationError("");
				form.clearErrors("name");
			}
		}, 300); // Debounce validation

		return () => clearTimeout(timeoutId);
	}, [watchedName, existingPortfolioNames, currentPortfolioName, form]);

	// Generate name suggestions
	const nameSuggestions = useMemo(() => {
		if (
			!showNameSuggestions ||
			!watchedName ||
			nameValidationError !== portfolioErrorMessages.nameExists
		) {
			return [];
		}
		return portfolioValidationHelpers.generateNameSuggestions(
			watchedName,
			existingPortfolioNames,
		);
	}, [
		watchedName,
		nameValidationError,
		existingPortfolioNames,
		showNameSuggestions,
	]);

	return (
		<>
			{/* Portfolio Name Field */}
			<FormField
				control={form.control}
				name="name"
				render={({ field }) => (
					<FormItem>
						<FormLabel>
							Portfolio Name <span className="text-destructive">*</span>
						</FormLabel>
						<FormControl>
							<Input
								{...field}
								placeholder={portfolioFormConfig.name.placeholder}
								maxLength={portfolioFormConfig.name.maxLength}
								autoComplete={portfolioFormConfig.name.autoComplete}
								autoFocus={autoFocus && portfolioFormConfig.name.autoFocus}
								disabled={disabled}
								className={nameValidationError ? "border-destructive" : ""}
							/>
						</FormControl>
						<FormDescription>
							Choose a unique name for your portfolio. Use letters, numbers,
							spaces, hyphens, underscores, and periods only.
						</FormDescription>
						<FormMessage />

						{/* Name Suggestions */}
						{nameSuggestions.length > 0 && (
							<div className="mt-2">
								<p className="text-sm text-muted-foreground mb-2">
									Suggestions:
								</p>
								<div className="flex flex-wrap gap-2">
									{nameSuggestions.map((suggestion, index) => (
										<Button
											key={index}
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												form.setValue("name", suggestion, {
													shouldValidate: true,
												});
											}}
											disabled={disabled}
											className="text-xs"
										>
											{suggestion}
										</Button>
									))}
								</div>
							</div>
						)}
					</FormItem>
				)}
			/>

			{/* Portfolio Description Field */}
			<FormField
				control={form.control}
				name="description"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Description (Optional)</FormLabel>
						<FormControl>
							<Textarea
								{...field}
								placeholder={portfolioFormConfig.description.placeholder}
								maxLength={portfolioFormConfig.description.maxLength}
								rows={portfolioFormConfig.description.rows}
								autoComplete={portfolioFormConfig.description.autoComplete}
								disabled={disabled}
								className="resize-none"
							/>
						</FormControl>
						<FormDescription>
							Add a description to help you remember this portfolio's purpose
							(max {portfolioFormConfig.description.maxLength} characters).
						</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>
		</>
	);
}

// Standalone name field component
export interface PortfolioNameFieldProps
	extends Omit<PortfolioFormFieldsProps, "showNameSuggestions"> {
	showSuggestions?: boolean;
}

export function PortfolioNameField({
	existingPortfolioNames = [],
	currentPortfolioName,
	disabled = false,
	autoFocus = true,
	showSuggestions = true,
}: PortfolioNameFieldProps) {
	const form = useFormContext<PortfolioFormData>();
	const [nameValidationError, setNameValidationError] = useState<string>("");

	const watchedName = form.watch("name");

	useEffect(() => {
		if (!watchedName?.trim()) {
			setNameValidationError("");
			return;
		}

		const timeoutId = setTimeout(() => {
			const isUnique = portfolioValidationHelpers.validateNameUniqueness(
				watchedName,
				existingPortfolioNames,
				currentPortfolioName,
			);

			if (!isUnique) {
				setNameValidationError(portfolioErrorMessages.nameExists);
				form.setError("name", { message: portfolioErrorMessages.nameExists });
			} else {
				setNameValidationError("");
				form.clearErrors("name");
			}
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [watchedName, existingPortfolioNames, currentPortfolioName, form]);

	const nameSuggestions = useMemo(() => {
		if (
			!showSuggestions ||
			!watchedName ||
			nameValidationError !== portfolioErrorMessages.nameExists
		) {
			return [];
		}
		return portfolioValidationHelpers.generateNameSuggestions(
			watchedName,
			existingPortfolioNames,
		);
	}, [
		watchedName,
		nameValidationError,
		existingPortfolioNames,
		showSuggestions,
	]);

	return (
		<FormField
			control={form.control}
			name="name"
			render={({ field }) => (
				<FormItem>
					<FormLabel>
						Portfolio Name <span className="text-destructive">*</span>
					</FormLabel>
					<FormControl>
						<Input
							{...field}
							placeholder={portfolioFormConfig.name.placeholder}
							maxLength={portfolioFormConfig.name.maxLength}
							autoComplete={portfolioFormConfig.name.autoComplete}
							autoFocus={autoFocus && portfolioFormConfig.name.autoFocus}
							disabled={disabled}
							className={nameValidationError ? "border-destructive" : ""}
						/>
					</FormControl>
					<FormDescription>
						Choose a unique name for your portfolio.
					</FormDescription>
					<FormMessage />

					{nameSuggestions.length > 0 && (
						<div className="mt-2">
							<p className="text-sm text-muted-foreground mb-2">Suggestions:</p>
							<div className="flex flex-wrap gap-2">
								{nameSuggestions.map((suggestion, index) => (
									<Button
										key={index}
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											form.setValue("name", suggestion, {
												shouldValidate: true,
											});
										}}
										disabled={disabled}
										className="text-xs"
									>
										{suggestion}
									</Button>
								))}
							</div>
						</div>
					)}
				</FormItem>
			)}
		/>
	);
}

// Standalone description field component
export interface PortfolioDescriptionFieldProps {
	disabled?: boolean;
}

export function PortfolioDescriptionField({
	disabled = false,
}: PortfolioDescriptionFieldProps) {
	const form = useFormContext<PortfolioFormData>();

	return (
		<FormField
			control={form.control}
			name="description"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Description (Optional)</FormLabel>
					<FormControl>
						<Textarea
							{...field}
							placeholder={portfolioFormConfig.description.placeholder}
							maxLength={portfolioFormConfig.description.maxLength}
							rows={portfolioFormConfig.description.rows}
							autoComplete={portfolioFormConfig.description.autoComplete}
							disabled={disabled}
							className="resize-none"
						/>
					</FormControl>
					<FormDescription>
						Add a description to help you remember this portfolio's purpose.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
