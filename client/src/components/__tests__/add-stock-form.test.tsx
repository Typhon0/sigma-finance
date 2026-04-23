import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddStockForm } from "../AddStockForm";

vi.mock("@/hooks/use-debounce", () => ({
	useDebounce: (value: string) => value,
}));

vi.mock("@/hooks/use-asset-management", () => ({
	useAssets: () => ({
		assets: [
			{
				id: "asset-1",
				name: "Apple Inc.",
				symbol: "AAPL",
				currentValue: 185.5,
				assetType: {
					id: "STOCK",
					name: "STOCK",
				},
			},
			{
				id: "asset-2",
				name: "Microsoft Corp.",
				symbol: "MSFT",
				currentValue: 378.2,
				assetType: {
					id: "STOCK",
					name: "STOCK",
				},
			},
			{
				id: "asset-3",
				name: "Vanguard FTSE All-World",
				symbol: "VWCE",
				currentValue: 105.8,
				assetType: {
					id: "FUND",
					name: "FUND",
				},
			},
		],
		loading: false,
		error: undefined,
		refetch: vi.fn(),
	}),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

// Mock the ui components
vi.mock("../ui/dialog", () => ({
	Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
		open ? <div data-testid="dialog">{children}</div> : null,
	DialogContent: ({ children }: { children: ReactNode }) => (
		<div data-testid="dialog-content">{children}</div>
	),
	DialogDescription: ({ children }: { children: ReactNode }) => <span>{children}</span>,
	DialogTitle: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("../ui/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
		variant,
	}: {
		children: ReactNode;
		onClick?: () => void;
		disabled?: boolean;
		variant?: string;
	}) => (
		<button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
			{children}
		</button>
	),
}));

vi.mock("../ui/input", () => ({
	Input: ({
		value,
		onChange,
		placeholder,
		type,
		id,
	}: {
		value?: string;
		onChange?: (e: { target: { value: string } }) => void;
		placeholder?: string;
		type?: string;
		id?: string;
	}) => (
		<input
			type={type || "text"}
			value={value}
			onChange={onChange ? (e) => onChange({ target: { value: e.target.value } }) : undefined}
			placeholder={placeholder}
			id={id}
		/>
	),
}));

vi.mock("../ui/label", () => ({
	Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
		<label htmlFor={htmlFor}>{children}</label>
	),
}));

vi.mock("../ui/badge", () => ({
	Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => (
		<span data-variant={variant}>{children}</span>
	),
}));

vi.mock("../ui/select", () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectValue: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("../ui/calendar", () => ({
	Calendar: () => <div data-testid="calendar" />,
}));

vi.mock("../ui/popover", () => ({
	Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../ui/textarea", () => ({
	Textarea: ({
		value,
		onChange,
	}: {
		value?: string;
		onChange?: (e: { target: { value: string } }) => void;
	}) => (
		<textarea
			value={value}
			onChange={onChange ? (e) => onChange({ target: { value: e.target.value } }) : undefined}
		/>
	),
}));

// Mock Logo component
vi.mock("../Logo", () => ({
	Logo: ({ compact }: { compact?: boolean }) => (
		<div data-testid="logo" data-compact={compact}>
			Logo
		</div>
	),
}));

// Mock PortfolioProvider
vi.mock("../PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [],
		selectedPortfolio: { id: "portfolio-1", name: "Test Portfolio" },
		addAsset: vi.fn(),
		addingAsset: false,
	}),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	X: () => <span data-testid="icon-x">X</span>,
	Search: () => <span data-testid="icon-search">Search</span>,
	ArrowRight: () => <span data-testid="icon-arrow-right">→</span>,
	RefreshCw: () => <span data-testid="icon-refresh">Refresh</span>,
	BarChart3: () => <span data-testid="icon-barchart">BarChart</span>,
	DollarSign: () => <span data-testid="icon-dollar">$</span>,
	TrendingUp: () => <span data-testid="icon-trending">Trending</span>,
	Calendar: () => <span data-testid="icon-calendar">Calendar</span>,
	Info: () => <span data-testid="icon-info">Info</span>,
	Building2: () => <span data-testid="icon-building">Building</span>,
	Wallet: () => <span data-testid="icon-wallet">Wallet</span>,
	Hash: () => <span data-testid="icon-hash">#</span>,
}));

describe("AddStockForm", () => {
	const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Initial Dialog State", () => {
		it("shows Add Position title when dialog opens", () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			expect(screen.getAllByText("Add Position").length).toBeGreaterThan(0);
		});

		it("shows Broker Sync and Manual Entry options", () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			expect(screen.getByRole("button", { name: /Broker Sync/i })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Manual Entry/i })).toBeInTheDocument();
		});
	});

	describe("Manual Entry Flow", () => {
		it("navigates to Manual Entry form when clicked", async () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByText("Manual Entry")).toBeInTheDocument();
			});
		});

		it("shows search input in Manual Entry form", async () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/Search symbol/i)).toBeInTheDocument();
			});
		});
	});

	describe("Stock Selection and Form Fields", () => {
		it("displays stock list when searching", async () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			// Navigate to manual entry
			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/Search symbol/i)).toBeInTheDocument();
			});

			// Search for AAPL
			const searchInput = screen.getByPlaceholderText(/Search symbol/i);
			fireEvent.change(searchInput, { target: { value: "AAPL" } });

			await waitFor(() => {
				expect(screen.getByText(/Apple Inc/i)).toBeInTheDocument();
			});
		});

		it("selects a stock and shows quantity/price fields", async () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			// Navigate to manual entry
			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/Search symbol/i)).toBeInTheDocument();
			});

			// Search for AAPL and select it
			const searchInput = screen.getByPlaceholderText(/Search symbol/i);
			fireEvent.change(searchInput, { target: { value: "AAPL" } });

			await waitFor(() => {
				expect(screen.getByText(/Apple Inc/i)).toBeInTheDocument();
			});
			fireEvent.click(screen.getByText(/Apple Inc/i));

			// Should see quantity and price fields with correct placeholders
			await waitFor(() => {
				const quantityInput = screen.getByPlaceholderText("0");
				const priceInput = screen.getByPlaceholderText("0.00");
				expect(quantityInput).toBeInTheDocument();
				expect(priceInput).toBeInTheDocument();
			});
		});

		it("fills in quantity and price fields", async () => {
			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

			// Navigate to manual entry and select stock
			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/Search symbol/i)).toBeInTheDocument();
			});

			const searchInput = screen.getByPlaceholderText(/Search symbol/i);
			fireEvent.change(searchInput, { target: { value: "AAPL" } });

			await waitFor(() => {
				expect(screen.getByText(/Apple Inc/i)).toBeInTheDocument();
			});
			fireEvent.click(screen.getByText(/Apple Inc/i));

			// Fill quantity and price
			const quantityInput = screen.getByPlaceholderText("0");
			const priceInput = screen.getByPlaceholderText("0.00");

			fireEvent.change(quantityInput, { target: { value: "10" } });
			fireEvent.change(priceInput, { target: { value: "150" } });

			expect((quantityInput as HTMLInputElement).value).toBe("10");
			expect((priceInput as HTMLInputElement).value).toBe("150");
		});
	});

	describe("Submit Behavior", () => {
		it("calls onSubmit with correct data when form is filled", async () => {
			const onSubmit = vi.fn().mockResolvedValue(undefined);

			render(<AddStockForm open={true} onClose={mockOnClose} onSubmit={onSubmit} />);

			// Navigate to manual entry and select stock
			const manualEntryButton = screen.getByRole("button", {
				name: /Manual Entry/i,
			});
			fireEvent.click(manualEntryButton);

			await waitFor(() => {
				expect(screen.getByPlaceholderText(/Search symbol/i)).toBeInTheDocument();
			});

			const searchInput = screen.getByPlaceholderText(/Search symbol/i);
			fireEvent.change(searchInput, { target: { value: "AAPL" } });

			await waitFor(() => {
				expect(screen.getByText(/Apple Inc/i)).toBeInTheDocument();
			});
			fireEvent.click(screen.getByText(/Apple Inc/i));

			// Fill quantity and price
			const quantityInput = screen.getByPlaceholderText("0");
			const priceInput = screen.getByPlaceholderText("0.00");

			fireEvent.change(quantityInput, { target: { value: "10" } });
			fireEvent.change(priceInput, { target: { value: "150" } });

			// Submit
			const submitButton = screen.getByRole("button", {
				name: /Add Position/i,
			});
			fireEvent.click(submitButton);

			await waitFor(() => {
				expect(onSubmit).toHaveBeenCalled();
			});

			const submittedData = onSubmit.mock.calls[0][0];
			expect(submittedData.symbol).toBe("AAPL");
			expect(submittedData.quantity).toBe(10);
			expect(submittedData.averageBuyPrice).toBe(150);
		});
	});
});
