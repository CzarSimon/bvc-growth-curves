import Link from "next/link";
import { PROVENANCE } from "@/lib/copy";
import { MEASURE_CONFIG, MEASURE_ORDER } from "@/lib/measures";
import { provenance } from "@/lib/growth";
import { formatNumber } from "@/lib/format";

const ANCHORS = ["0", "3", "6", "9", "12", "15", "18", "21", "24"];

/**
 * Which reference, which version, and how it was obtained — reachable so a
 * clinician can check what is actually being plotted.
 */
export default function AboutCurvesPage() {
  const sexes = [
    { key: "female" as const, label: "Flickor" },
    { key: "male" as const, label: "Pojkar" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 py-6 pb-12 lg:px-8">
      <Link href="/barn" className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent">
        ← Tillbaka
      </Link>
      <h1 className="font-serif text-[30px] font-semibold">{PROVENANCE.title}</h1>

      <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4.5">
        <p className="prose-copy m-0 text-base/[1.6] text-ink-secondary">{PROVENANCE.intro}</p>
        <p className="prose-copy m-0 text-base/[1.6] text-ink-secondary">
          {PROVENANCE.sdExplainer}
        </p>
        <p className="prose-copy m-0 text-base/[1.6] text-ink-secondary">
          {PROVENANCE.distributionExplainer}
        </p>
        <p className="prose-copy m-0 text-base/[1.6] text-ink-secondary">
          {PROVENANCE.ageExplainer}
        </p>
      </div>

      <div className="rounded-[14px] border border-border-strong bg-surface p-4.5">
        <p className="prose-copy m-0 text-base/[1.6] text-ink-secondary">
          {PROVENANCE.disclaimer}
        </p>
      </div>

      {sexes.map(({ key, label }) => {
        const data = provenance(key);
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="font-serif text-[22px] font-semibold">{label}</h2>
            <p className="m-0 text-sm text-ink-muted">
              Källa: {data.source.pdf} — {data.source.chartCitation}. Ålder{" "}
              {data.source.ageRangeMonths[0]}–{data.source.ageRangeMonths[1]} månader.
            </p>

            <div className="overflow-x-auto">
              <table className="nums w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken text-left text-xs tracking-[0.05em] text-ink-muted uppercase">
                    <th className="px-3 py-2 font-semibold">Mått</th>
                    <th className="px-3 py-2 font-semibold">Fördelning</th>
                    <th className="px-3 py-2 font-semibold">z</th>
                    <th className="px-3 py-2 font-semibold">Punkter</th>
                    <th className="px-3 py-2 font-semibold">R² (log)</th>
                    <th className="px-3 py-2 font-semibold">±3 SD, max px</th>
                  </tr>
                </thead>
                <tbody>
                  {data.measures.map((measure) => (
                    <tr key={measure.measure} className="border-t border-hairline">
                      <td className="px-3 py-2">
                        {MEASURE_CONFIG[measure.measure].label} ({measure.unit})
                      </td>
                      <td className="px-3 py-2">{measure.distribution}</td>
                      <td className="px-3 py-2 font-mono text-xs">{measure.zscore}</td>
                      <td className="px-3 py-2">{measure.knots}</td>
                      <td className="px-3 py-2">{measure.calibration.r2Log.toFixed(6)}</td>
                      <td className="px-3 py-2">
                        {String(measure.validation.sd3HeldOutMaxPx ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="prose-copy m-0 text-sm/[1.55] text-ink-muted">
              {PROVENANCE.chartIsTruth}
            </p>

            <div className="overflow-x-auto">
              <table className="nums w-full min-w-[560px] border-collapse text-sm">
                <caption className="pb-2 text-left text-xs text-ink-muted">
                  Diagrammet minus tabellen, medianen, i procent per åldersavstämning
                </caption>
                <thead>
                  <tr className="bg-surface-sunken text-left text-xs tracking-[0.05em] text-ink-muted uppercase">
                    <th className="px-3 py-2 font-semibold">Mått</th>
                    {ANCHORS.map((anchor) => (
                      <th key={anchor} className="px-2 py-2 font-semibold">
                        {anchor} mån
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEASURE_ORDER.map((measure) => {
                    const entry = data.measures.find((item) => item.measure === measure)!;
                    return (
                      <tr key={measure} className="border-t border-hairline">
                        <td className="px-3 py-2">{MEASURE_CONFIG[measure].label}</td>
                        {ANCHORS.map((anchor) => (
                          <td key={anchor} className="px-2 py-2">
                            {formatNumber(entry.table4DivergencePct[anchor] ?? 0, 2)} %
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
