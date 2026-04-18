// Custom SVG arrows matching Finary design
export const TrendArrowUp = ({ className = "" }: { className?: string }) => (
	<svg className={className} viewBox="0 0 16 16" width="16" height="16">
		<title>Chart</title>
		<path
			d="M6.23784 1.30751C6.99212 -0.0985939 9.00843 -0.0985962 9.76271 1.3075L15.6196 12.2257C16.3343 13.5581 15.3691 15.1711 13.8571 15.1711H2.14341C0.631443 15.1711 -0.333754 13.5581 0.38097 12.2257L6.23784 1.30751Z"
			transform="rotate(180 8 8)"
			fill="currentColor"
		/>
	</svg>
);

export const TrendArrowDown = ({ className = "" }: { className?: string }) => (
	<svg className={className} viewBox="0 0 16 16" width="16" height="16">
		<title>Chart</title>
		<path
			d="M6.23784 1.30751C6.99212 -0.0985939 9.00843 -0.0985962 9.76271 1.3075L15.6196 12.2257C16.3343 13.5581 15.3691 15.1711 13.8571 15.1711H2.14341C0.631443 15.1711 -0.333754 13.5581 0.38097 12.2257L6.23784 1.30751Z"
			fill="currentColor"
		/>
	</svg>
);
