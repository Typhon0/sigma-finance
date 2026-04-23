import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type DesignSystemStyle = "vega" | "nova" | "maia" | "lyra" | "mira" | "luma" | "sera";

interface DesignSystemContextType {
	style: DesignSystemStyle;
	setStyle: (style: DesignSystemStyle) => void;
}

const STORAGE_KEY = "sigma-finance-design-system";

const DEFAULT_STYLE: DesignSystemStyle = "vega";

const DesignSystemContext = createContext<DesignSystemContextType>({
	style: DEFAULT_STYLE,
	setStyle: () => {},
});

function isValidStyle(value: string): value is DesignSystemStyle {
	return ["vega", "nova", "maia", "lyra", "mira", "luma", "sera"].includes(value);
}

function readSavedStyle(): DesignSystemStyle {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw && isValidStyle(raw)) return raw;
	} catch {
		// localStorage may be unavailable (private mode, etc.)
	}
	return DEFAULT_STYLE;
}

function writeSavedStyle(style: DesignSystemStyle): void {
	try {
		localStorage.setItem(STORAGE_KEY, style);
	} catch {
		// ignore
	}
}

function applyStyleToDocument(style: DesignSystemStyle): void {
	document.documentElement.dataset.style = style;
}

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
	const [style, setStyleState] = useState<DesignSystemStyle>(readSavedStyle);

	useEffect(() => {
		applyStyleToDocument(style);
	}, [style]);

	const setStyle = (next: DesignSystemStyle) => {
		setStyleState(next);
		writeSavedStyle(next);
		applyStyleToDocument(next);
	};

	return (
		<DesignSystemContext.Provider value={{ style, setStyle }}>
			{children}
		</DesignSystemContext.Provider>
	);
}

export function useDesignSystem(): DesignSystemContextType {
	const ctx = useContext(DesignSystemContext);
	if (!ctx) {
		throw new Error("useDesignSystem must be used within a DesignSystemProvider");
	}
	return ctx;
}
