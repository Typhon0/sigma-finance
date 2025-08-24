import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Test component to demonstrate error boundary functionality
 * This component can be used to trigger errors in dashboard sections for testing
 */
export function ErrorTestComponent() {
	const [shouldThrow, setShouldThrow] = useState(false);

	if (shouldThrow) {
		throw new Error("Test error triggered by ErrorTestComponent");
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Error Boundary Test</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground mb-4">
					This component can be used to test error boundary functionality in
					dashboard sections.
				</p>
				<Button variant="destructive" onClick={() => setShouldThrow(true)}>
					Trigger Error
				</Button>
			</CardContent>
		</Card>
	);
}
