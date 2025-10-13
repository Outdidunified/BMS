	import { Chart } from "@/components/chart/chart";
	import { useChart } from "@/components/chart/useChart";
	import Icon from "@/components/icon/icon";
	import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
	import { Text, Title } from "@/ui/typography";
	import { Skeleton } from "@/ui/skeleton";
	import { useCallback, useEffect, useMemo, useState } from "react";
	import dashboardService, { type DashboardSummary, type ChartData } from "@/api/services/dashboardService";
import devicesService, { type DeviceDoc } from "@/api/services/devicesService";
	import { useUserToken } from "@/store/userStore";

	export default function BMSDashboard() {
		const [summary, setSummary] = useState<DashboardSummary | null>(null);
		const [chartData, setChartData] = useState<ChartData | null>(null);
	const [, setDevices] = useState<DeviceDoc[]>([]);
		const [loading, setLoading] = useState(true);
		const { accessToken } = useUserToken();

		useEffect(() => {
			// Only fetch data if user is authenticated
			if (!accessToken) {
				setLoading(false);
				return;
			}

			const fetchData = async () => {
				try {
						const [summaryRes, chartRes, devicesRes] = await Promise.all([
						dashboardService.getSummary(),
						dashboardService.getCharts(),
							devicesService.listDevices(true),
					]);
					setSummary(summaryRes);
					setChartData(chartRes);
					setDevices(devicesRes);
				} catch (error) {
					console.error('Failed to fetch dashboard data:', error);
				} finally {
					setLoading(false);
				}
			};
			fetchData();
		}, [accessToken]);

		// Chart options - must be called before any conditional returns
		const devicePieOptions = useChart({
			labels: chartData?.deviceStatusPie.labels || [],
			stroke: { show: false },
			legend: { show: false },
			tooltip: { fillSeriesColor: false },
			plotOptions: {
				pie: { donut: { size: "60%" } },
			},
		});

		const voltageTrendOptions = useChart({
			xaxis: { categories: chartData?.batteryVoltageTrend.labels || [] },
		});

		const tempTrendOptions = useChart({
			xaxis: { categories: chartData?.temperatureTrend.labels || [] },
		});

		const currentTrendOptions = useChart({
			xaxis: { categories: chartData?.currentTrend.labels || [] },
		});

		const warningsBarOptions = useChart({
			xaxis: { categories: chartData?.warningsBar.labels || [] },
			plotOptions: {
				bar: { horizontal: false },
			},
		});

		if (!accessToken) {
			return (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-none shadow-none">
						<div>
							<Title as="h4" className="text-xl mb-1">
								BMS Dashboard Overview
							</Title>
							<Text variant="body2" className="text-muted-foreground">
								Monitor battery management system metrics and analytics.
							</Text>
						</div>
					</div>
					<div className="flex items-center justify-center h-64">
						<div className="text-center">
							<Text variant="body1" className="mb-2">
								Please log in to view the dashboard
							</Text>
							<Text variant="body2" className="text-muted-foreground">
								You need to be authenticated to access dashboard data.
							</Text>
						</div>
					</div>
				</div>
			);
		}

		if (loading) {
			return (
				<div className="flex flex-col gap-4">
					{/* Header Skeleton */}
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-none shadow-none">
						<div>
							<Skeleton className="h-8 w-64 mb-2" />
							<Skeleton className="h-4 w-96" />
						</div>
					</div>

					{/* Summary Cards Skeleton */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<Card key={index}>
								<CardHeader className="flex flex-row items-center justify-between pb-2">
									<Skeleton className="h-4 w-24" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-8 w-16" />
								</CardContent>
							</Card>
						))}
					</div>

					{/* Charts Skeleton */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<Card key={index}>
								<CardHeader>
									<Skeleton className="h-6 w-48" />
								</CardHeader>
								<CardContent>
									<div className="w-full min-h-[300px]">
										<Skeleton className="h-[300px] w-full" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Warnings Bar Chart Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32" />
						</CardHeader>
						<CardContent>
							<div className="w-full min-h-[300px]">
								<Skeleton className="h-[300px] w-full" />
							</div>
						</CardContent>
					</Card>

					{/* Battery Health Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40" />
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{Array.from({ length: 3 }).map((_, index) => (
									<div key={index}>
										<Skeleton className="h-4 w-24 mb-2" />
										<Skeleton className="h-8 w-20" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Users by Role Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-28" />
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-4">
								{Array.from({ length: 3 }).map((_, index) => (
									<div key={index}>
										<Skeleton className="h-4 w-16 mb-2" />
										<Skeleton className="h-8 w-12" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (!summary || !chartData) {
			return (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-none shadow-none">
						<div>
							<Title as="h4" className="text-xl mb-1">
								BMS Dashboard Overview
							</Title>
							<Text variant="body2" className="text-muted-foreground">
								Monitor battery management system metrics and analytics.
							</Text>
						</div>
					</div>
					<div className="flex items-center justify-center h-64">
						<div className="text-center">
							<Text variant="body1" className="mb-2 text-destructive">
								Error loading dashboard data
							</Text>
							<Text variant="body2" className="text-muted-foreground">
								Please check your connection and try refreshing the page.
							</Text>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-col gap-4">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-none shadow-none">
					<div>
						<Title as="h4" className="text-xl mb-1">
							BMS Dashboard Overview
						</Title>
						<Text variant="body2" className="text-muted-foreground">
							Monitor battery management system metrics and analytics.
						</Text>
					</div>
				</div>

				{/* Summary Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle>
								<Text variant="subTitle2">Total Devices</Text>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Title as="h3" className="text-xl">
								{summary.totalDevices}
							</Title>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle>
								<Text variant="subTitle2">Online Devices</Text>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Title as="h3" className="text-xl">
								{summary.onlineDevices}
							</Title>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle>
								<Text variant="subTitle2">Total Stations</Text>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Title as="h3" className="text-xl">
								{summary.totalStations}
							</Title>
						</CardContent>
					</Card>

				</div>

				{/* Charts */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Device Status Pie Chart */}
					<Card>
						<CardHeader>
							<CardTitle>Device Status</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="w-full min-h-[300px]">
								<Chart
									type="donut"
									height={300}
									options={devicePieOptions}
									series={chartData.deviceStatusPie.data}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Battery Voltage Trend */}
					<Card>
						<CardHeader>
							<CardTitle>Battery Voltage Trend (Last 30 Days)</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="w-full min-h-[300px]">
								<Chart
									type="line"
									height={300}
									options={voltageTrendOptions}
									series={chartData.batteryVoltageTrend.datasets}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Temperature Trend */}
					<Card>
						<CardHeader>
							<CardTitle>Temperature Trend (Last 30 Days)</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="w-full min-h-[300px]">
								<Chart
									type="line"
									height={300}
									options={tempTrendOptions}
									series={chartData.temperatureTrend.datasets}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Current Trend */}
					<Card>
						<CardHeader>
							<CardTitle>Charging Current Trend (Last 30 Days)</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="w-full min-h-[300px]">
								<Chart
									type="line"
									height={300}
									options={currentTrendOptions}
									series={chartData.currentTrend.datasets}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Warnings Bar Chart */}
				<Card>
					<CardHeader>
						<CardTitle>Warnings by Type</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="w-full min-h-[300px]">
							<Chart
								type="bar"
								height={300}
								options={warningsBarOptions}
								series={[{ name: "Warnings", data: chartData.warningsBar.data }]}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Battery Health */}
				<Card>
					<CardHeader>
						<CardTitle>Battery Health Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<Text variant="subTitle2" className="text-muted-foreground">
									Avg Pack Voltage
								</Text>
								<Title as="h3" className="text-xl">
									{summary.batteryHealth.avgPackVoltage.toFixed(2)} V
								</Title>
							</div>
							<div>
								<Text variant="subTitle2" className="text-muted-foreground">
									Avg Temperature
								</Text>
								<Title as="h3" className="text-xl">
									{summary.batteryHealth.avgTemperature.toFixed(2)} °C
								</Title>
							</div>
							<div>
								<Text variant="subTitle2" className="text-muted-foreground">
									Avg Charging Current
								</Text>
								<Title as="h3" className="text-xl">
									{summary.batteryHealth.avgChargingCurrent.toFixed(2)} A
								</Title>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}