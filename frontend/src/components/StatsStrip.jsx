export default function StatsStrip({ doctor }) {
  if (!doctor) return null;

  const items = [
    { label: "Today's avg consult", value: doctor.todays_avg_consultation_min },
    { label: "Doctor's typical avg", value: doctor.avg_consultation_min },
    { label: "Last patient took", value: doctor.last_patient_duration_min },
  ];

  return (
    <section className="qa-stats" aria-label="Consultation time context">
      {items.map((item) => (
        <div className="qa-stats__cell" key={item.label}>
          <span className="qa-stats__value">{item.value != null ? `${item.value} min` : "—"}</span>
          <span className="qa-stats__label">{item.label}</span>
        </div>
      ))}
    </section>
  );
}
