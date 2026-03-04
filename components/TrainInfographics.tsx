import React, { useMemo, useState } from 'react';
import { Wagon, Station, Language } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line, Legend, LabelList
} from 'recharts';
import {
    TrainFront, MapPin, Calendar, Search, BarChart3,
    Activity, ArrowRight, Package, TrendingUp, Info, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrainInfographicsProps {
    wagons: Wagon[];
    stations: Station[];
    lang: Language;
}

const PALETTE = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
    '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#84cc16', '#ef4444', '#64748b',
];

// Exact entry keys we should look for anywhere in the string
const KNOWN_CODES = [
    '6980', '6900', '6600', '7076', '9800', '9859', // САРЫАГАЧ
    '7247', // СЫРДАРЬЯ
    '6628', '6611', // КАРАКАЛПАКСТАН
    '7478', '7476', '74-76', // БЕКАБАД / ИСТИКЛОЛ
    '7458', // КУДУКЛИ
    '7464', // АМУЗАНГ
    '7585', // ТАХИАТАШ
    '7571', '7502', '7504', // ХОДЖИДАВЛЕТ / 161
    '7568', '7498', // РАЗЪЕЗД 161
    '7180', '7192', '7191', // КИРГИЗИЯ
    '7364' // ГАЛАБА
];

const matchMgspRobust = (indexStr: string): { from: string, to: string, mgsp: string } => {
    let searchArea = indexStr;
    const parenMatch = indexStr.match(/\((.*?)\)/);
    if (parenMatch) searchArea = parenMatch[1]; // Look inside parens strongly if they exist

    let fromCode = '';
    for (const code of KNOWN_CODES) {
        if (searchArea.includes(code)) {
            fromCode = code.replace('-', ''); // normalize 74-76 -> 7476
            break;
        }
    }

    // Try finding destination code (last 4 digits in searchArea)
    let toCode = '';
    const parts = searchArea.match(/\d{4}/g);
    if (parts && parts.length > 1) {
        toCode = parts[parts.length - 1]; // usually the last part
    } else if (!fromCode && parts && parts.length === 1) {
        // Only one code? Let's assume it's the From code if fromCode is empty
        fromCode = parts[0];
    }

    let mgsp = 'Неизвестно';
    if (['6980', '6900', '6600', '7076', '9800', '9859'].includes(fromCode)) mgsp = 'САРЫАГАЧ';
    else if (fromCode === '7247') mgsp = 'СЫРДАРЬЯ';
    else if (['6628', '6611'].includes(fromCode)) mgsp = 'КАРАКАЛПАКСТАН';
    else if (fromCode === '7458') mgsp = 'КУДУКЛИ';
    else if (fromCode === '7464') mgsp = 'АМУЗАНГ';
    else if (fromCode === '7585') mgsp = 'ТАХИАТАШ';
    else if (['7180', '7192', '7191'].includes(fromCode)) mgsp = 'КИРГИЗИЯ';
    else if (fromCode === '7364') mgsp = 'ГАЛАБА';
    // Ambiguous cases -> Use toCode to guess
    else if (['7478', '7476'].includes(fromCode)) {
        mgsp = toCode === '7400' ? 'ИСТИКЛОЛ' : 'БЕКАБАД';
    } else if (['7571', '7502', '7504', '7568', '7498'].includes(fromCode)) {
        if (fromCode === '7504') mgsp = toCode === '7300' ? 'ХОДЖИДАВЛЕТ' : 'РАЗЪЕЗД 161';
        else if (['7571', '7502'].includes(fromCode)) mgsp = 'ХОДЖИДАВЛЕТ';
        else mgsp = 'РАЗЪЕЗД 161';
    }

    return { from: fromCode, to: toCode, mgsp };
};

const resolveStation = (code: string, stations: Station[]): string => {
    if (!code) return code;
    const prefix = code.substring(0, 4);
    const found = stations.find(s => s.fullCode?.startsWith(prefix) || s.id?.startsWith(prefix));
    return found ? found.name : code;
};

const toDate = (raw: any): Date | null => {
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};

type PeriodType = 'day' | 'month' | 'year';
const formatKey = (d: Date, p: PeriodType) => p === 'day' ? d.toISOString().slice(0, 10) : p === 'month' ? d.toISOString().slice(0, 7) : String(d.getFullYear());
const formatLabel = (key: string, p: PeriodType, lang: Language) => {
    if (p === 'day') return new Date(key + 'T00:00:00').toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: 'short' });
    if (p === 'month') { const [y, m] = key.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { month: 'short', year: 'numeric' }); }
    return key;
};

// ─── Render explicit text inside / on top of bars ───
const CustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (!value || value === 0) return null;

    // Position text in the center-top of the column
    return (
        <text
            x={x + width / 2}
            y={y - 8} // 8px above the top of the bar
            fill="#475569"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="900"
        >
            {value}
        </text>
    );
};

interface StikRecord {
    idx: string;
    fromCode: string;
    toCode: string;
    mgsp: string;
    date: Date | null;
    wagons: number;
    destName: string;
}

const TrainInfographics: React.FC<TrainInfographicsProps> = ({ wagons, stations, lang }) => {
    const [selectedMgsp, setSelectedMgsp] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodType>('day');
    const [useRange, setUseRange] = useState(false);
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
    const [search, setSearch] = useState('');

    // ── Build Stiks using Robust Match ──
    const stikList = useMemo((): StikRecord[] => {
        const map = new Map<string, StikRecord>();
        wagons.forEach(w => {
            const key = (w.trainIndex || '').trim();
            if (!key) return;
            if (map.has(key)) {
                const ex = map.get(key)!;
                ex.wagons++;
                if (!ex.date) { const d = toDate(w.arrivalDate || (w as any).ad); if (d) ex.date = d; }
                return;
            }

            const { from, to, mgsp } = matchMgspRobust(key);
            let destName = to ? resolveStation(to, stations) : (lang === 'uz' ? 'Nomaʼlum st.' : 'Неизвестная ст.');
            // Fallback if resolve fails
            if (destName === to) destName = lang === 'uz' ? `Stansiya ${to}` : `Станция ${to}`;

            const date = toDate(w.arrivalDate || (w as any).ad);

            map.set(key, { idx: key, fromCode: from, toCode: to, mgsp, destName, date, wagons: 1 });
        });
        return Array.from(map.values());
    }, [wagons, stations, lang]);

    // ── MGSP Panel ──
    const mgspList = useMemo(() => {
        const cnt = new Map<string, number>();
        stikList.forEach(s => cnt.set(s.mgsp, (cnt.get(s.mgsp) || 0) + 1));
        return Array.from(cnt.entries())
            .sort((a, b) => b[1] - a[1]) // highest traffic first
            .map(([name, count]) => ({ name, count }));
    }, [stikList]);

    const effectiveMgsp = selectedMgsp ?? mgspList[0]?.name ?? null;
    const mgspStiks = useMemo(() => stikList.filter(s => s.mgsp === effectiveMgsp), [stikList, effectiveMgsp]);

    // ── Dates ──
    const allDates = useMemo(() => mgspStiks.map(s => s.date).filter(Boolean) as Date[], [mgspStiks]);
    const minD = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
    const maxD = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
    const rStart = useRange && rangeStart ? new Date(rangeStart + 'T00:00:00') : minD;
    const rEnd = useRange && rangeEnd ? new Date(rangeEnd + 'T23:59:59') : maxD;

    const finalStiks = useMemo(() => mgspStiks.filter(s => !s.date || (s.date >= rStart && s.date <= rEnd)), [mgspStiks, rStart, rEnd]);

    // ── Chart Data ──
    const uniqueDests = useMemo(() => {
        const c = new Map<string, number>();
        finalStiks.forEach(s => c.set(s.destName, (c.get(s.destName) || 0) + 1));
        return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    }, [finalStiks]);

    const chartData = useMemo(() => {
        const tm = new Map<string, Record<string, number>>();
        finalStiks.forEach(s => {
            if (!s.date) return;
            const k = formatKey(s.date, period);
            const e = tm.get(k) || {};
            e[s.destName] = (e[s.destName] || 0) + 1;
            tm.set(k, e);
        });
        return Array.from(tm.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, vals]) => ({ key, label: formatLabel(key, period, lang), ...vals }));
    }, [finalStiks, period, lang]);

    const totalStiks = finalStiks.length;

    const applyPreset = (p: 'week' | 'month' | 'quarter') => {
        const end = new Date(); const start = new Date();
        if (p === 'week') start.setDate(start.getDate() - 7);
        else if (p === 'month') start.setMonth(start.getMonth() - 1);
        else start.setMonth(start.getMonth() - 3);
        setRangeStart(start.toISOString().slice(0, 10)); setRangeEnd(end.toISOString().slice(0, 10)); setUseRange(true);
    };

    const filteredMgsp = search.trim() ? mgspList.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : mgspList;

    if (!wagons.length) return <div className="p-20 text-center text-slate-400 font-bold">{lang === 'uz' ? 'Ma\'lumot yo\'q' : 'Нет данных'}</div>;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
        return (
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100/50 p-4 text-xs" style={{ minWidth: 240 }}>
                <p className="font-black text-slate-800 mb-3 pb-2 border-b border-slate-100 text-sm">{label}</p>
                <div className="space-y-2">
                    {[...payload].filter(p => p.value > 0).sort((a, b) => b.value - a.value).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center group">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: p.fill || p.color }} />
                                <span className="font-bold text-slate-600 truncate max-w-[150px]">{p.name}</span>
                            </div>
                            <span className="font-black text-slate-900 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100">{p.value}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between font-bold text-slate-500 bg-slate-50/50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                    <span>{lang === 'uz' ? 'Shu davrdagi jami:' : 'Итого за период:'}</span>
                    <span className="font-black text-blue-600 text-sm">{total} {lang === 'uz' ? 'ta' : 'шт'}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col xl:flex-row gap-6">
            {/* ══ LEFT SIDEBAR ══ */}
            <div className="w-full xl:w-[300px] flex-shrink-0 flex flex-col gap-4">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 shadow-xl shadow-indigo-500/20 text-white relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <p className="text-[11px] font-black uppercase text-indigo-200 tracking-widest mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {lang === 'uz' ? 'Tizimdagi jami poezdlar' : 'Всего поездов в системе'}</p>
                    <div className="text-5xl font-black mb-1">{stikList.length}</div>
                    <p className="text-indigo-200 text-xs font-bold">{lang === 'uz' ? 'barcha MGSP punktlaridan' : 'со всех точек МГСП'}</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100 flex flex-col flex-1 h-[600px]">
                    <div className="p-4 bg-slate-50 rounded-t-3xl border-b border-slate-100 flex items-center justify-between">
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{lang === 'uz' ? 'MGSP (Kirish punktlari)' : 'МГСП (Точки входа)'}</p>
                        <span className="bg-white py-0.5 px-2 rounded-lg text-[10px] font-black text-indigo-600 border border-indigo-100 shadow-sm">{mgspList.length}</span>
                    </div>
                    <div className="p-3 border-b border-slate-50 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-300" />
                            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border border-slate-100 focus:border-indigo-300 transition-all placeholder:text-slate-400" placeholder={lang === 'uz' ? 'Stikni qidirish...' : 'Поиск МГСП...'} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {filteredMgsp.map((m, i) => {
                            const act = m.name === effectiveMgsp;
                            return (
                                <button key={m.name} onClick={() => setSelectedMgsp(m.name)}
                                    className={`group w-full flex items-center justify-between p-3 rounded-2xl mb-1.5 transition-all duration-300
                                        ${act ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/25 scale-[1.02]'
                                            : m.name === 'Неизвестно' ? 'bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100'
                                                : 'bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md text-slate-700'}`}>
                                    <div className="flex items-center gap-3 truncate">
                                        <div className={`w-6 h-6 rounded-xl flex items-center justify-center text-[10px] font-black transition-colors ${act ? 'bg-white/20 text-white' : m.name === 'Неизвестно' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{i + 1}</div>
                                        <span className="text-xs font-black truncate tracking-wide">{m.name}</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg ${act ? 'bg-white/20 text-white' : m.name === 'Неизвестно' ? 'bg-rose-100/50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                                        {m.count} <TrainFront className="w-3 h-3 opacity-70" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══ RIGHT PANEL ══ */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

                {/* ── Context Header ── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
                                <TrainFront className="w-8 h-8" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-xl ring-4 ring-white shadow-sm">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" /> {lang === 'uz' ? 'Faol MGSP stik:' : 'Активный МГСП:'}
                            </p>
                            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{effectiveMgsp}</h2>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="text-right px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'uz' ? 'Jami poezdlar' : 'Всего поездов'}</p>
                            <p className="text-2xl font-black text-slate-800">{totalStiks}</p>
                        </div>
                        <div className="text-right px-5 py-3 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{lang === 'uz' ? 'Yo\'nalishlar' : 'Направлений'}</p>
                            <p className="text-2xl font-black text-blue-700">{uniqueDests.length}</p>
                        </div>
                    </div>
                </div>

                {/* ── Controls Row ── */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full sm:w-auto">
                        <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto">
                            {(['day', 'month', 'year'] as PeriodType[]).map(p => (
                                <button key={p} onClick={() => setPeriod(p)} className={`flex-1 px-4 py-1.5 text-[11px] font-black rounded-md transition-colors ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                                    {p === 'day' ? (lang === 'uz' ? 'Kunlik' : 'По дням') : p === 'month' ? (lang === 'uz' ? 'Oylik' : 'По месяцам') : (lang === 'uz' ? 'Yillik' : 'По годам')}
                                </button>
                            ))}
                        </div>
                        <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button onClick={() => setUseRange(!useRange)} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all ${useRange ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                📅 {lang === 'uz' ? 'Interval' : 'Фильтр дат'}
                            </button>
                            <AnimatePresence>
                                {useRange && (
                                    <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 overflow-hidden">
                                        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="py-1 text-[11px] font-bold text-slate-700 bg-transparent outline-none w-24" />
                                        <span className="text-slate-300">-</span>
                                        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="py-1 text-[11px] font-bold text-slate-700 bg-transparent outline-none w-24" />
                                        <button onClick={() => { setRangeStart(''); setRangeEnd(''); setUseRange(false) }} className="text-rose-500 text-lg px-1 font-black hover:text-rose-600">&times;</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* ── Main Dynamic Chart (Grouped Bars with direct Labels) ── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100 p-6 flex-1 min-h-[450px] relative">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                {lang === 'uz' ? `${effectiveMgsp} => Qaysi stansiyaga qachon nechtadan?` : `График поездов из ${effectiveMgsp} по пунктам назначения`}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">
                                {lang === 'uz' ? 'Har bir ustunda yo\'nalishlarning aniq stik sonlari birma-bir ko\'rsatilgan' : 'Каждый столбец наглядно показывает количество поездов для каждого направления в отдельности'}
                            </p>
                        </div>
                        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner">
                            <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg transition-all ${chartType === 'bar' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 className="w-4 h-4" /></button>
                            <button onClick={() => setChartType('line')} className={`p-2 rounded-lg transition-all ${chartType === 'line' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><Activity className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {chartData.length > 0 && uniqueDests.length > 0 ? (
                        <div style={{ height: Math.max(350, Math.min(chartData.length * 80, 550)) }} className="mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'bar' ? (
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barGap={8} barCategoryGap="25%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }} dy={10} />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#cbd5e1' }} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.6 }} />
                                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ paddingTop: 30 }} formatter={v => <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>{v}</span>} />
                                        {/* Notice NO stackId -> Bars are rendered side-by-side grouped by Date! */}
                                        {uniqueDests.map((dest, i) => (
                                            <Bar key={dest} dataKey={dest} name={dest} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} maxBarSize={50}>
                                                <LabelList dataKey={dest} content={<CustomLabel />} />
                                            </Bar>
                                        ))}
                                    </BarChart>
                                ) : (
                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }} dy={10} />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#cbd5e1' }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ paddingTop: 30 }} formatter={v => <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>{v}</span>} />
                                        {uniqueDests.map((dest, i) => (
                                            <Line key={dest} type="monotone" dataKey={dest} name={dest} stroke={PALETTE[i % PALETTE.length]} strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7, stroke: PALETTE[i % PALETTE.length], strokeWidth: 3, fill: '#fff' }} />
                                        ))}
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <Info className="w-12 h-12 opacity-20 mb-4" />
                            <p className="font-bold text-lg">{lang === 'uz' ? 'Ushbu davrda qatnovlar yo\'q' : 'Нет данных за этот период'}</p>
                        </div>
                    )}
                </div>

                {/* ── Summary Cards (Allohsida yacheykalar) ── */}
                {uniqueDests.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {uniqueDests.map((dest, i) => {
                            const cnt = finalStiks.filter(s => s.destName === dest).length;
                            const color = PALETTE[i % PALETTE.length];
                            return (
                                <motion.div key={dest} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-slate-100 relative overflow-hidden group hover:scale-[1.03] transition-transform">
                                    <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-slate-50 transition-colors group-hover:bg-slate-100" style={{ opacity: 0.5 }}></div>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 shadow-sm relative z-10" style={{ backgroundColor: `${color}15` }}>
                                        <MapPin className="w-5 h-5" style={{ color }} />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1 truncate relative z-10" title={dest}>{dest}</p>
                                    <div className="flex items-end gap-2 relative z-10">
                                        <p className="text-3xl font-black" style={{ color }}>{cnt}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mb-1.5">{lang === 'uz' ? 'poezd' : 'поездов'}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainInfographics;
