interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	showText?: boolean;
	className?: string;
}

export function Logo({
	size = "md",
	showText = true,
	className = "",
}: LogoProps) {
	const sizeClasses = {
		sm: {
			container: "h-8 w-8",
			text: "text-xs",
			title: "text-sm",
			subtitle: "text-[10px]",
			logoText: "text-lg",
		},
		md: {
			container: "h-12 w-12",
			text: "text-sm",
			title: "text-lg",
			subtitle: "text-xs",
			logoText: "text-2xl",
		},
		lg: {
			container: "h-16 w-16",
			text: "text-base",
			title: "text-xl",
			subtitle: "text-sm",
			logoText: "text-3xl",
		},
		xl: {
			container: "h-24 w-24",
			text: "text-lg",
			title: "text-3xl",
			subtitle: "text-base",
			logoText: "text-5xl",
		},
	};

	const sizes = sizeClasses[size];

	return (
		<div className={`flex items-center gap-3 ${className}`}>
			{/* Logo Icon */}
			<div
				className={`${sizes.container} bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group transition-transform hover:scale-105`}
			>
				{/* Background Pattern */}
				<div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

				{/* Sigma F Logo */}
				<div
					className={`${sizes.logoText} font-bold text-primary-foreground relative z-10 tracking-tighter`}
				>
					ΣF
				</div>
			</div>

			{/* Text */}
			{showText && (
				<div className="flex flex-col">
					<h1
						className={`${sizes.title} font-semibold tracking-tight leading-tight`}
					>
						Sigma Finance
					</h1>
					<p
						className={`${sizes.subtitle} text-muted-foreground leading-tight`}
					>
						Portfolio Management
					</p>
				</div>
			)}
		</div>
	);
}

// Compact version for small spaces
export function LogoCompact({ className = "" }: { className?: string }) {
	return (
		<div
			className={`h-10 w-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-md group hover:shadow-lg transition-all hover:scale-105 ${className}`}
		>
			<div className="text-xl font-bold text-primary-foreground tracking-tighter">
				ΣF
			</div>
		</div>
	);
}

// Icon only version
export function LogoIcon({
	size = "md",
	className = "",
}: {
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const sizeClasses = {
		sm: "h-8 w-8 text-lg",
		md: "h-12 w-12 text-2xl",
		lg: "h-16 w-16 text-3xl",
	};

	const sizeClass = sizeClasses[size];

	return (
		<div
			className={`${sizeClass} bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 ${className}`}
		>
			<div className="font-bold text-primary-foreground tracking-tighter">
				ΣF
			</div>
		</div>
	);
}
