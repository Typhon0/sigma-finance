"use client";

import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
	date?: Date;
	onChange: (date?: Date) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	disabledDates?: (date: Date) => boolean;
}

export function DatePicker({
	date,
	onChange,
	placeholder = "YYYY-MM-DD",
	className,
	disabled,
	disabledDates,
}: DatePickerProps) {
	const [inputValue, setInputValue] = React.useState(date ? format(date, "yyyy-MM-dd") : "");

	// Update input value when date prop changes
	React.useEffect(() => {
		if (date && isValid(date)) {
			setInputValue(format(date, "yyyy-MM-dd"));
		} else {
			setInputValue("");
		}
	}, [date]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);

		// Try to parse different formats
		// Primarily yyyy-mm-dd
		let parsedDate = parse(value, "yyyy-MM-dd", new Date());

		if (!isValid(parsedDate)) {
			// Try dd.mm.yyyy
			parsedDate = parse(value, "dd.MM.yyyy", new Date());
		}

		if (!isValid(parsedDate)) {
			// Try mm/dd/yyyy
			parsedDate = parse(value, "MM/dd/yyyy", new Date());
		}

		if (isValid(parsedDate) && value.length >= 8) {
			onChange(parsedDate);
		} else if (value === "") {
			onChange(undefined);
		}
	};

	const handleBlur = () => {
		if (date && isValid(date)) {
			setInputValue(format(date, "yyyy-MM-dd"));
		} else if (inputValue !== "") {
			// If invalid, revert or clear
			setInputValue(date ? format(date, "yyyy-MM-dd") : "");
		}
	};

	return (
		<div className={cn("relative flex items-center w-full", className)}>
			<Input
				type="text"
				placeholder={placeholder}
				value={inputValue}
				onChange={handleInputChange}
				onBlur={handleBlur}
				disabled={disabled}
				className="pr-10 font-mono"
			/>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						disabled={disabled}
						className="absolute right-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors"
					>
						<CalendarIcon className="h-4 w-4" />
						<span className="sr-only">Open calendar</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="end">
					<Calendar
						mode="single"
						selected={date}
						onSelect={(newDate) => {
							onChange(newDate);
						}}
						disabled={disabledDates}
						captionLayout="dropdown"
						startMonth={new Date(1900, 0)}
						endMonth={new Date(new Date().getFullYear() + 20, 11)}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
