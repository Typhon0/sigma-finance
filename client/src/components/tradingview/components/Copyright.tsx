import type React from "react";
import type { CopyrightStyles } from "..";

export type CopyrightProps = {
	copyrightStyles?: CopyrightStyles;
	href?: string;
	spanText?: string;
	text?: string;
	children?: never;
};

const Copyright: React.FC<CopyrightProps> = ({
	href,
	spanText,
	text = "By TradingView",
	copyrightStyles,
}) => {
	const defaultStyles: CopyrightStyles = {
		parent: {
			fontSize: "11px",
			lineHeight: "18px",
			textAlign: "center",
			verticalAlign: "middle",
			fontFamily: "inherit",
			color: "var(--muted-foreground, #71717a)",
			marginTop: "4px",
			marginBottom: "2px",
			opacity: 0.65,
		},
		link: {
			textDecoration: "none",
			color: "inherit",
		},
		span: {
			color: "inherit",
			fontWeight: 500,
		},
	};

	return (
		<div
			style={Object.assign({}, defaultStyles.parent, copyrightStyles?.parent)}
			className="tradingview-widget-copyright"
		>
			<a
				style={Object.assign({}, defaultStyles.link, copyrightStyles?.link)}
				href={href}
				target="_blank"
				rel="noopener"
				className="hover:underline transition-opacity hover:opacity-100"
			>
				<span style={Object.assign({}, defaultStyles.span, copyrightStyles?.span)}>
					{spanText}{" "}
				</span>
			</a>
			{text}
		</div>
	);
};

export default Copyright;
