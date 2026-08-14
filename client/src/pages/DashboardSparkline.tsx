type DashboardSparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
};

export function DashboardSparkline({
  data,
  width = 120,
  height = 30,
  color = "#3b82f6",
  className = "",
}: DashboardSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const effectiveHeight = height - padding * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * stepX;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="transition-all duration-300"
      />
      {/* Ponto final de destaque */}
      <circle
        cx={width}
        cy={height - padding - ((data[data.length - 1] - min) / range) * effectiveHeight}
        r="3"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}
