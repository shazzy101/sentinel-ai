import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data, width = 80, height = 28 }) {
  if (!data?.length || data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="w-full h-[1px] bg-border-subtle" />
      </div>
    );
  }

  const first = data[0]?.balance || 0;
  const last = data[data.length - 1]?.balance || 0;
  const lineColor = last >= first ? '#00D992' : '#FF4D4D';

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="balance"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
