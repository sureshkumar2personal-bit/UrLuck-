/** Winning number as a butterfly body, with left + right wings. */
export default function FlyingNumber({ value }: { value: number }) {
  return (
    <div
      aria-hidden="true"
      className="flying-number pointer-events-none fixed inset-0 z-50"
    >
      <div className="flying-track absolute top-0 left-0">
        <div className="flying-bob">
          <div className="bfly">
            <div className="bfly-wing bfly-wing-left" />
            <div className="bfly-body">{value}</div>
            <div className="bfly-wing bfly-wing-right" />
          </div>
        </div>
      </div>
    </div>
  );
}
