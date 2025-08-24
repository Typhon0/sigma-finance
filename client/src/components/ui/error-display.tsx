import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorDisplayProps {
	error: Error;
	title?: string;
	message?: string;
}

export function ErrorDisplay({
	error,
	title = "An Error Occurred",
	message,
}: ErrorDisplayProps) {
	return (
		<Alert variant="destructive">
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				{message || error.message || "Something went wrong."}
			</AlertDescription>
		</Alert>
	);
}
