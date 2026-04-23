import ReactECharts from "echarts-for-react";

interface PieChartData {
	name: string;
	value: number;
}

interface PieChartWithCenterProps {
	data: PieChartData[];
	height?: string;
	formatValue?: (value: number) => string;
	centerLabel?: string;
	colors?: string[];
}

export function PieChartWithCenter({
	data,
	height = "300px",
	formatValue = (value) => value.toLocaleString(),
	centerLabel = "Total",
	colors,
}: PieChartWithCenterProps) {
	const total = data.reduce((sum, item) => sum + item.value, 0);

	const defaultColors = [
		"#5470c6",
		"#91cc75",
		"#fac858",
		"#ee6666",
		"#73c0de",
		"#3ba272",
		"#fc8452",
		"#9a60b4",
		"#ea7ccc",
	];

	const chartColors = colors || defaultColors;

	// Obtenir la taille de 1rem en pixels
	const getRootFontSize = () => {
		return parseFloat(getComputedStyle(document.documentElement).fontSize);
	};

	const rem = getRootFontSize();

	const option = {
		color: chartColors,
		tooltip: {
			show: false, // Désactive le tooltip
		},
		legend: {
			show: false,
		},
		series: [
			{
				name: centerLabel,
				type: "pie",
				radius: ["40%", "70%"],
				avoidLabelOverlap: false,
				label: {
					show: true,
					position: "center",
					formatter: () => {
						return `{a|${centerLabel}}\n{b|${formatValue(total)}}`;
					},
					rich: {
						a: {
							fontSize: rem * 0.625, // 0.625rem = 10px
							color: "#9CA3AF", // Gris clair
							lineHeight: rem * 0.875,
						},
						b: {
							fontSize: rem * 1, // 1rem = 16px
							fontWeight: "bold",
							color: "#E5E7EB", // Gris presque blanc
							lineHeight: rem * 1.25,
						},
					},
				},
				emphasis: {
					label: {
						show: true, // Active le label au hover
						position: "center",
						formatter: (params: any) => {
							return `{a|${params.name}}\n{b|${formatValue(params.value)}}\n{c|${params.percent}%}`;
						},
						rich: {
							a: {
								fontSize: rem * 0.625, // 0.625rem = 10px pour le nom
								color: "#9CA3AF",
								lineHeight: rem * 0.875,
							},
							b: {
								fontSize: rem * 1, // 1rem = 16px pour la valeur
								fontWeight: "bold",
								color: "#E5E7EB",
								lineHeight: rem * 1.25,
							},
							c: {
								fontSize: rem * 0.5625, // 0.5625rem = 9px pour le pourcentage
								color: "#6B7280",
								lineHeight: rem * 0.75,
							},
						},
					},
				},
				labelLine: {
					show: false,
				},
				data: data,
			},
		],
	};

	return <ReactECharts option={option} style={{ height }} notMerge={true} lazyUpdate={true} />;
}
