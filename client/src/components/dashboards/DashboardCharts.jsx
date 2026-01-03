import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

// Corporate Color Palette (muted blues/greens for business dashboards)
const CORP_COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#0ea5e9',
  accent: '#10b981',
  muted: '#6b7280'
};

const CHART_COLORS = [
  CORP_COLORS.primary,
  CORP_COLORS.secondary,
  '#38bdf8',
  '#a5b4fc',
  '#f97316',
  '#22c55e'
];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, currency = false, theme = 'light' }) => {
  if (active && payload && payload.length) {
    const isDark = theme === 'dark';
    return (
      <div style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '4px 0', color: entry.color, fontSize: '0.875rem' }}>
            <span style={{ fontWeight: 600 }}>{entry.name}:</span>{' '}
            {currency ? `₹${entry.value.toLocaleString('en-IN')}` : entry.value.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Sales Trend Chart - Enhanced with Area
export const SalesTrendChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No sales data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CORP_COLORS.primary} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={CORP_COLORS.primary} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CORP_COLORS.secondary} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={CORP_COLORS.secondary} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis 
          dataKey="date" 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }}
          style={{ fontSize: '0.75rem' }}
        />
        <YAxis 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <Tooltip content={<CustomTooltip currency={true} theme={theme} />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
          iconType="circle"
        />
        <Area 
          type="monotone" 
          dataKey="total" 
          stroke={CORP_COLORS.primary} 
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRevenue)" 
          name="Revenue"
        />
        <Area 
          type="monotone" 
          dataKey="count" 
          stroke={CORP_COLORS.secondary} 
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorCount)" 
          name="Sales Count"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// Sales by Type Chart - Enhanced Pie Chart
export const SalesByTypeChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No sales data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="total"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip currency={true} theme={theme} />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Category Performance Chart - Enhanced Bar Chart
export const CategoryPerformanceChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No category data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis 
          dataKey="category" 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <YAxis 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <Tooltip content={<CustomTooltip currency={true} theme={theme} />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
          iconType="square"
        />
        <Bar 
          dataKey="revenue" 
          fill={CORP_COLORS.primary} 
          name="Revenue"
          radius={[8, 8, 0, 0]}
        />
        <Bar 
          dataKey="quantity" 
          fill={CORP_COLORS.secondary} 
          name="Quantity"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Service Status Chart - Enhanced Pie Chart
export const ServiceStatusChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No service data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip theme={theme} />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Services by Type Chart - Enhanced Bar Chart
export const ServicesByTypeChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No service data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis 
          dataKey="type" 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <YAxis 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <Tooltip content={<CustomTooltip currency={true} theme={theme} />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
          iconType="square"
        />
        <Bar 
          dataKey="revenue" 
          fill={CORP_COLORS.primary} 
          name="Revenue"
          radius={[8, 8, 0, 0]}
        />
        <Bar 
          dataKey="count" 
          fill={CORP_COLORS.secondary} 
          name="Count"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Payment Methods Chart - Enhanced Pie Chart
export const PaymentMethodsChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No payment data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="total"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip currency={true} theme={theme} />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Stock by Category Chart - Enhanced Bar Chart
export const StockByCategoryChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#cbd5e1' : '#64748b';

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '60px 20px', 
        textAlign: 'center', 
        color: textColor,
        fontSize: '0.875rem'
      }}>
        No inventory data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis 
          dataKey="category" 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <YAxis 
          stroke={axisColor}
          tick={{ fill: axisColor }}
          style={{ fontSize: '0.75rem' }}
        />
        <Tooltip content={<CustomTooltip theme={theme} />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px', color: axisColor }}
          iconType="square"
        />
        <Bar 
          dataKey="totalQty" 
          fill={CORP_COLORS.primary} 
          name="Total Quantity"
          radius={[8, 8, 0, 0]}
        />
        <Bar 
          dataKey="productCount" 
          fill={CORP_COLORS.secondary} 
          name="Product Count"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
