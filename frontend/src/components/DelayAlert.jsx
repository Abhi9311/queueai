export default function DelayAlert({ prediction }) {
  if (!prediction || !prediction.is_delayed || prediction.status === "completed") return null;

  return (
    <div className="qa-alert" role="status">
      <span className="qa-alert__icon" aria-hidden="true">
        !
      </span>
      Running about {Math.round(prediction.delay_min)} min behind the original schedule.
    </div>
  );
}
