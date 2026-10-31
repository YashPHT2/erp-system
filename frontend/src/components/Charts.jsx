import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatInr } from '../utils/format';

const MODE_COLORS = ['#4f46e5', '#0f766e', '#64748b'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-slate-700">{label || payload[0].name}</p>
      <p className="mt-1 tabular-nums text-slate-900">{formatInr(payload[0].value)}</p>
    </div>
  );
}

export function CollectionChart({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="amount" stroke="#4f46e5" fill="#eef2ff" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModeChart({ data }) {
  const rows = data?.filter((item) => item.amount > 0) || [];
  if (!rows.length) {
    return <p className="py-16 text-center text-sm text-slate-500">No collections in this period.</p>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="amount" nameKey="label" innerRadius={58} outerRadius={80} paddingAngle={2}>
            {rows.map((entry, index) => (
              <Cell key={entry.mode || entry.label} fill={MODE_COLORS[index % MODE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBarChart({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="amount" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
