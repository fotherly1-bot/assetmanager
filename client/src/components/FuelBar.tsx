import { fuelColour, fuelPercent } from '../lib/format';

export function FuelBar({
  level,
  tank,
  showLabel = true,
}: {
  level: number | null | undefined;
  tank: number | null | undefined;
  showLabel?: boolean;
}) {
  const pct = fuelPercent(level, tank);
  if (pct == null) return <span className="badge badge-grey">N/A</span>;
  const colour = fuelColour(pct);
  return (
    <div>
      <div className="fuel-bar" title={`${pct.toFixed(0)}%`}>
        <div className="fuel-bar-fill" style={{ width: `${pct}%`, background: colour }} />
      </div>
      {showLabel && (
        <div className="fuel-meta">
          {level?.toFixed(0)} / {tank} L ({pct.toFixed(0)}%)
        </div>
      )}
    </div>
  );
}
