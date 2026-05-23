type Props = { x?: number; y?: number; width?: number; value?: number };

export function BarLabel({ x, y, width, value }: Props) {
  if (value == null || !width) return null;
  return (
    <text
      x={(x ?? 0) + width / 2}
      y={(y ?? 0) - 4}
      textAnchor="middle"
      className="chart-bar-label"
      fontSize={10}
      fill="rgba(128,128,128,0.9)"
      fontWeight={600}
    >
      {value}
    </text>
  );
}
