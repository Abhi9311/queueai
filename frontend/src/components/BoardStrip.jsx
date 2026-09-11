function pad(n) {
  if (n === null || n === undefined) return "—";
  return String(n).padStart(3, "0");
}

export default function BoardStrip({ nowServing, yourToken, patientsAhead, onTokenChange, tokenOptions }) {
  return (
    <section className="qa-board" aria-label="Queue position board">
      <div className="qa-board__cell">
        <span className="qa-board__label">Now serving</span>
        <span className="qa-board__digits">{pad(nowServing)}</span>
      </div>

      <div className="qa-board__divider" />

      <div className="qa-board__cell">
        <span className="qa-board__label">Your token</span>
        <select
          className="qa-board__select"
          value={yourToken ?? ""}
          onChange={(e) => onTokenChange(Number(e.target.value))}
        >
          {tokenOptions.map((t) => (
            <option key={t} value={t}>
              {pad(t)}
            </option>
          ))}
        </select>
      </div>

      <div className="qa-board__divider" />

      <div className="qa-board__cell">
        <span className="qa-board__label">Patients ahead</span>
        <span className="qa-board__digits qa-board__digits--small">{patientsAhead ?? "—"}</span>
      </div>
    </section>
  );
}
