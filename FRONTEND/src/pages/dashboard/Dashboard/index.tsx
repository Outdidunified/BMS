import { Chart } from "@/components/chart/chart";
import { useChart } from "@/components/chart/useChart";
import Icon from "@/components/icon/icon";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Text, Title } from "@/ui/typography";
import { useMemo, useState } from "react";

// ---------------------- Data ----------------------
const timeOptions = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

// Live data containers
interface LiveState {
  pv?: number; // pack voltage
  cc?: number; // charging current
  dc?: number; // discharging current
  lc?: number; // load current
  voltages?: number[];
  temperatures?: number[];
}

export default function Analysis() {
  const [timeType, setTimeType] = useState<"day" | "week" | "month">("day");

  // Static mock data
  const live: LiveState = {
    pv: 48.5,
    cc: 2.1,
    dc: 0.0,
    lc: 1.5,
    voltages: [3.8, 3.9, 3.7, 3.8, 3.9, 3.8],
    temperatures: [25, 26, 24, 25],
  };

  // Static analytics
  const analytics = {
    avg: { pv: 47.8, cc: 1.8, dc: 0.2, lc: 1.2 }
  };

  // Build series from live voltages
  const deviceLabels = useMemo(
    () => (live.voltages?.length ? live.voltages.map((_, i) => `Cell ${i + 1}`) : ["Cell 1", "Cell 2", "Cell 3"]),
    [live.voltages]
  );
  const deviceValues = useMemo(() => (live.voltages?.length ? live.voltages : [1, 1, 1]), [live.voltages]);

  const chartOptions = useChart({ xaxis: { categories: deviceLabels } });
  const deviceChartOptions = useChart({
    labels: deviceLabels,
    stroke: { show: false },
    legend: { show: false },
    tooltip: { fillSeriesColor: false },
    plotOptions: { pie: { donut: { size: "60%" } } },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header and filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-none shadow-none">
        <div>
          <Title as="h4" className="text-xl mb-1">
            Analysis overview
          </Title>
          <Text variant="body2" className="text-muted-foreground">
            Explore live telemetry and analytics.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Text variant="body2" className="text-muted-foreground">
            Show by:
          </Text>
          <Select value={timeType} onValueChange={(v) => setTimeType(v as any)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col xl:grid grid-cols-4 gap-4">
        {/* Main chart card */}
        <Card className="col-span-4 xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>
              <Title as="h3" className="text-lg">
                Pack voltages
              </Title>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <Text variant="subTitle2" className="text-muted-foreground">
                  Pack Voltage
                </Text>
                <div className="flex items-end gap-2">
                  <Title as="h3" className="text-2xl">{Number(live.pv ?? 0).toFixed(2)} V</Title>
                </div>
              </div>
              <div>
                <Text variant="subTitle2" className="text-muted-foreground">
                  Currents
                </Text>
                <div className="flex items-end gap-2">
                  <Title as="h3" className="text-2xl">
                    {Number(live.cc ?? 0).toFixed(2)} / {Number(live.dc ?? 0).toFixed(2)} / {Number(live.lc ?? 0).toFixed(2)} A
                  </Title>
                </div>
              </div>
            </div>
            <div className="w-full min-h-[200px] mt-2">
              <Chart type="line" height={320} options={chartOptions} series={[{ name: "Voltage", data: deviceValues }]} />
            </div>
          </CardContent>
        </Card>

        {/* Right-side small cards */}
        <div className="xl:col-span-1 h-full">
          <div className="flex flex-col xl:flex-col md:flex-row gap-4 h-full">
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>
                  <Text variant="subTitle2">Avg pack voltage</Text>
                </CardTitle>
                <CardAction className="rounded-full bg-orange-200 p-2 w-10 h-10 flex items-center justify-center">
                  <Icon icon="mdi:flash" size={20} color="black" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <Title as="h3" className="text-xl">{Number(analytics.avg?.pv ?? 0).toFixed(2)} V</Title>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>
                  <Text variant="subTitle2">Session devices</Text>
                </CardTitle>
                <CardAction className="rounded-full bg-emerald-200 p-2 w-10 h-10 flex items-center justify-center">
                  <Icon icon="mdi:devices" size={20} color="black" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-[180px]">
                  <Chart type="donut" height={320} options={deviceChartOptions} series={deviceValues} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
