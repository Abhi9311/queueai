import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function windowAroundServing(patients, nowServing, span = 10) {
  if (!patients?.length) return [];
  const servingIdx = patients.findIndex((p) => p.token === nowServing);
  const center = servingIdx >= 0 ? servingIdx : 0;
  const start = Math.max(0, center - 3);
  const end = Math.min(patients.length, start + span);
  return patients.slice(start, end);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="qa-chart__tooltip">
      <p className="qa-chart__tooltip-title">Token {label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="qa-chart__tooltip-row">
          {entry.name}: {entry.value != null ? `${entry.value} min` : "not yet known"}
        </p>
      ))}
    </div>
  );
}

export default function QueueChart({ patients, nowServing }) {
  const windowed = windowAroundServing(patients, nowServing);
  const data = windowed.map((p) => ({
    token: p.token,
    Predicted: p.predicted_duration_min,
    Actual: p.status === "completed" ? p.actual_duration_min : null,
    status: p.status,
  }));

  // Give each token a fixed minimum width so bars/labels never get
  // squeezed into overlapping each other on narrow screens -- the
  // container scrolls horizontally instead of shrinking the chart.
  const chartMinWidth = Math.max(data.length * 58, 320);

  return (
    <section className="qa-chart" aria-label="Queue movement, predicted vs actual">
      <div className="qa-chart__heading">
        <h2>Queue movement</h2>
        <p>Predicted vs. actual consultation length, near the current position</p>
      </div>
      <div className="qa-chart__scroll">
        <div style={{ minWidth: chartMinWidth, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="token"
                tickFormatter={(t) => `#${t}`}
                tick={{ fill: "var(--ink-soft)", fontSize: 12, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                width={34}
                tick={{ fill: "var(--ink-soft)", fontSize: 12, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "min", position: "insideTopLeft", fill: "var(--ink-soft)", fontSize: 11, dx: 10, dy: -6 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg)" }} />
              <Bar dataKey="Predicted" fill="var(--border-strong)" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Actual" fill="var(--live)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="qa-chart__legend">
        <span>
          <i className="qa-chart__swatch qa-chart__swatch--predicted" /> Predicted
        </span>
        <span>
          <i className="qa-chart__swatch qa-chart__swatch--actual" /> Actual
        </span>
      </div>
    </section>
  );
}
