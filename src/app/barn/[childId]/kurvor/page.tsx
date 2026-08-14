import { notFound } from "next/navigation";
import { ChartScreen, type ChartScreenData } from "@/components/chart-screen";
import { getChild, listMeasurements } from "@/lib/db";
import { ageDays, correctedAge, seriesFor } from "@/lib/child-data";
import { CHART } from "@/lib/copy";
import { formatAge, formatDate, formatGestation, todayIso } from "@/lib/format";
import { MEASURE_ORDER, measureFromSlug } from "@/lib/measures";
import { ageCorrectionDays, type Measure, type OutOfRangeReason } from "@/lib/growth";
import type { CurvePoint } from "@/lib/child-data";

export default async function ChartPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ matt?: string }>;
}) {
  const { childId } = await params;
  const { matt } = await searchParams;
  const [child, measurements] = await Promise.all([getChild(childId), listMeasurements(childId)]);
  if (!child) notFound();

  const series = {} as Record<Measure, CurvePoint[]>;
  const notPlotted = {} as Record<Measure, Partial<Record<OutOfRangeReason, number>>>;
  const ageDaysByMeasurement: Record<string, number> = {};
  for (const measure of MEASURE_ORDER) {
    const { points, unplottable } = seriesFor(child, measurements, measure);
    series[measure] = points;
    notPlotted[measure] = {};
    for (const point of points) {
      ageDaysByMeasurement[point.measurementId] = ageDays(child, point.measuredOn);
    }
    for (const entry of unplottable) {
      notPlotted[measure][entry.reason] = (notPlotted[measure][entry.reason] ?? 0) + 1;
    }
  }

  const sex = child.sex === "female" ? "Flicka" : "Pojke";
  const today = todayIso();
  const data: ChartScreenData = {
    childId: child.id,
    childName: child.name,
    childMeta: `${sex} · ${formatAge(ageDays(child, today))} · född ${formatDate(child.birthDate)}`,
    sex: child.sex,
    birthDate: child.birthDate,
    todayAgeMonths: correctedAge(child, today),
    footnote: CHART.footnote(
      ageCorrectionDays(child.gestationWeeks, child.gestationDays),
      formatGestation(child.gestationWeeks, child.gestationDays),
    ),
    series,
    notPlotted,
    ageDaysByMeasurement,
  };

  return <ChartScreen data={data} initialMeasure={measureFromSlug(matt ?? "") ?? "weight"} />;
}
