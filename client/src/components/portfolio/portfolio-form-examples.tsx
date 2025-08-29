import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	CompactPortfolioForm,
	CreatePortfolioDialog,
	EditPortfolioDialog,
	EnhancedPortfolioForm,
	type PortfolioFormData,
	QuickCreatePortfolioForm,
} from "./index";

// Example usage of portfolio form components
export function PortfolioFormExamples() {
	const [portfolios, setPortfolios] = useState([
		{
			id: "1",
			name: "Tech Stocks",
			description: "Technology focused portfolio",
		},
		{
			id: "2",
			name: "Dividend Growth",
			description: "Dividend growth strategy",
		},
	]);

	const existingNames = portfolios.map((p) => p.name);

	const handleCreatePortfolio = async (data: PortfolioFormData) => {
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const newPortfolio = {
			id: Date.now().toString(),
			name: data.name,
			description: data.description || null,
		};

		setPortfolios((prev) => [...prev, newPortfolio]);
		console.log("Created portfolio:", newPortfolio);
	};

	const handleUpdatePortfolio = async (id: string, data: PortfolioFormData) => {
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));

		setPortfolios((prev) =>
			prev.map((p) =>
				p.id === id
					? { ...p, name: data.name, description: data.description || null }
					: p,
			),
		);
		console.log("Updated portfolio:", id, data);
	};

	const handleSuccess = (data: PortfolioFormData) => {
		console.log("Form submitted successfully:", data);
	};

	const handleError = (error: Error) => {
		console.error("Form submission error:", error);
	};

	return (
		<div className="space-y-8 p-6">
			<div>
				<h1 className="text-3xl font-bold">Portfolio Form Examples</h1>
				<p className="text-muted-foreground">
					Examples of different portfolio form components and their usage.
				</p>
			</div>

			{/* Enhanced Portfolio Form */}
			<Card>
				<CardHeader>
					<CardTitle>Enhanced Portfolio Form</CardTitle>
					<CardDescription>
						Full-featured form with validation, suggestions, and advanced UX
						features.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<EnhancedPortfolioForm
						mode="create"
						onSubmit={handleCreatePortfolio}
						onCancel={() => console.log("Cancelled")}
						existingPortfolioNames={existingNames}
						onSuccess={handleSuccess}
						onError={handleError}
					/>
				</CardContent>
			</Card>

			{/* Compact Portfolio Form */}
			<Card>
				<CardHeader>
					<CardTitle>Compact Portfolio Form</CardTitle>
					<CardDescription>
						Streamlined form perfect for dialogs and modals.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CompactPortfolioForm
						mode="create"
						onSubmit={handleCreatePortfolio}
						onCancel={() => console.log("Cancelled")}
						existingPortfolioNames={existingNames}
						onSuccess={handleSuccess}
						onError={handleError}
					/>
				</CardContent>
			</Card>

			{/* Quick Create Form */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Create Form</CardTitle>
					<CardDescription>
						Minimal form for quick portfolio creation.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<QuickCreatePortfolioForm
						onSubmit={handleCreatePortfolio}
						existingPortfolioNames={existingNames}
						onSuccess={handleSuccess}
						onError={handleError}
					/>
				</CardContent>
			</Card>

			{/* Dialog Examples */}
			<Card>
				<CardHeader>
					<CardTitle>Dialog Forms</CardTitle>
					<CardDescription>
						Portfolio forms integrated with dialog components.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex gap-4">
						<CreatePortfolioDialog
							onSubmit={handleCreatePortfolio}
							existingPortfolioNames={existingNames}
							onSuccess={handleSuccess}
							onError={handleError}
						>
							<Button>Create Portfolio Dialog</Button>
						</CreatePortfolioDialog>

						{portfolios.length > 0 && (
							<EditPortfolioDialog
								portfolio={portfolios[0]}
								onSubmit={(data) =>
									handleUpdatePortfolio(portfolios[0].id, data)
								}
								existingPortfolioNames={existingNames}
								onSuccess={handleSuccess}
								onError={handleError}
							>
								<Button variant="outline">Edit "{portfolios[0].name}"</Button>
							</EditPortfolioDialog>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Current Portfolios */}
			<Card>
				<CardHeader>
					<CardTitle>Current Portfolios</CardTitle>
					<CardDescription>
						List of portfolios created using the forms above.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{portfolios.length === 0 ? (
						<p className="text-muted-foreground">No portfolios created yet.</p>
					) : (
						<div className="space-y-2">
							{portfolios.map((portfolio) => (
								<div
									key={portfolio.id}
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div>
										<h4 className="font-medium">{portfolio.name}</h4>
										{portfolio.description && (
											<p className="text-sm text-muted-foreground">
												{portfolio.description}
											</p>
										)}
									</div>
									<EditPortfolioDialog
										portfolio={portfolio}
										onSubmit={(data) =>
											handleUpdatePortfolio(portfolio.id, data)
										}
										existingPortfolioNames={existingNames}
										onSuccess={handleSuccess}
										onError={handleError}
									>
										<Button variant="ghost" size="sm">
											Edit
										</Button>
									</EditPortfolioDialog>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// Example of using the form in a page component
export function CreatePortfolioPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (data: PortfolioFormData) => {
		setIsLoading(true);
		setError("");

		try {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Simulate random error for demo
			if (Math.random() > 0.7) {
				throw new Error("Failed to create portfolio. Please try again.");
			}

			setSuccess(true);
			console.log("Portfolio created:", data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		// Navigate back or close
		console.log("Create cancelled");
	};

	return (
		<div className="max-w-2xl mx-auto p-6">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Create New Portfolio</h1>
				<p className="text-muted-foreground">
					Set up a new portfolio to organize your investments.
				</p>
			</div>

			<EnhancedPortfolioForm
				mode="create"
				onSubmit={handleSubmit}
				onCancel={handleCancel}
				isLoading={isLoading}
				errorMessage={error}
				showSuccessMessage={success}
				existingPortfolioNames={[
					"Existing Portfolio 1",
					"Existing Portfolio 2",
				]}
			/>
		</div>
	);
}

// Example of using the form in edit mode
export function EditPortfolioPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [success, setSuccess] = useState(false);

	// Mock portfolio data
	const portfolio = {
		id: "1",
		name: "Tech Stocks",
		description: "Technology focused investment portfolio",
	};

	const handleSubmit = async (data: PortfolioFormData) => {
		setIsLoading(true);
		setError("");

		try {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 2000));

			setSuccess(true);
			console.log("Portfolio updated:", data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		// Navigate back
		console.log("Edit cancelled");
	};

	return (
		<div className="max-w-2xl mx-auto p-6">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Edit Portfolio</h1>
				<p className="text-muted-foreground">
					Update your portfolio information.
				</p>
			</div>

			<EnhancedPortfolioForm
				portfolio={portfolio}
				mode="edit"
				onSubmit={handleSubmit}
				onCancel={handleCancel}
				isLoading={isLoading}
				errorMessage={error}
				showSuccessMessage={success}
				existingPortfolioNames={["Other Portfolio 1", "Other Portfolio 2"]}
			/>
		</div>
	);
}
