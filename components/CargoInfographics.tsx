import React, { useMemo, useState } from 'react';
import { Wagon, Language, Station } from '../types';
import { getCargoNameTranslated, getTranslation } from '../utils/translations';
import { PackageOpen, TrendingUp, BarChart3, Weight, Box, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface CargoInfographicsProps {
    wagons: Wagon[];
    stations: Station[];
    lang: Language;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
                <p className="font-bold text-slate-800 mb-1">{payload[0].name}</p>
                <p className="text-slate-600">
                    Вагоны: <span className="font-bold">{payload[0].payload.wagons}</span> ед.
                </p>
                <p className="text-blue-600 font-bold mt-0.5">
                    Вес: {payload[0].value.toLocaleString()} т
                </p>
            </div>
        );
    }
    return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100 text-xs">
                <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-600 w-16">{entry.name}:</span>
                        <span className="font-bold text-slate-800">{entry.value.toLocaleString()} т</span>
                    </div>
                ))}
                <div className="mt-2 pt-1 border-t border-slate-100 font-bold text-slate-800 flex justify-between">
                    <span>Итого:</span>
                    <span>{(payload[0]?.value + (payload[1]?.value || 0)).toLocaleString()} т</span>
                </div>
            </div>
        );
    }
    return null;
};

const CargoInfographics: React.FC<CargoInfographicsProps> = ({ wagons, lang }) => {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const t = (key: string) => getTranslation(key, lang);

    // Advanced Cargo Data Computation
    const stats = useMemo(() => {
        let totalWeight = 0;
        let totalWagons = 0;
        let importWeight = 0;
        let transitWeight = 0;

        const cargoMap = new Map<string, {
            code: string;
            name: string;
            totalWagons: number;
            totalWeight: number;
            importWagons: number;
            importWeight: number;
            transitWagons: number;
            transitWeight: number;
        }>();

        wagons.forEach(w => {
            // Ignore empty wagons completely for cargo context
            if (!w.cargoWeight || w.cargoWeight <= 0) return;

            const destDor = w.matchedStation?.dor;
            const rName = w.matchedStation?.regionName?.toLowerCase() || '';

            const isKyrgyzstan = destDor === 71 || rName.includes('кирг') || rName.includes('кырг');
            const isTurkmenistan = destDor === 75 || rName.includes('турк');
            const isKazakhstan = (destDor >= 66 && destDor <= 70) && !isKyrgyzstan;
            const isTajikistan = destDor === 74 || rName.includes('тадж') || rName.includes('бек') || rName.includes('куд');
            const isGalaba = w.matchedStation?.name?.toLowerCase().includes('галаба');

            const isImport = destDor === 73 && !isGalaba;
            const isTransit = isKazakhstan || isTurkmenistan || isKyrgyzstan || isTajikistan || isGalaba;

            const cCode = w.cargoCode || 'UNKNOWN';
            const cName = getCargoNameTranslated(cCode, lang);
            const unifiedKey = `${cCode}_${cName}`;

            if (!cargoMap.has(unifiedKey)) {
                cargoMap.set(unifiedKey, {
                    code: cCode,
                    name: cName,
                    totalWagons: 0,
                    totalWeight: 0,
                    importWagons: 0,
                    importWeight: 0,
                    transitWagons: 0,
                    transitWeight: 0
                });
            }

            const cs = cargoMap.get(unifiedKey)!;
            cs.totalWagons += 1;
            cs.totalWeight += w.cargoWeight;

            if (isImport) {
                cs.importWagons += 1;
                cs.importWeight += w.cargoWeight;
                importWeight += w.cargoWeight;
            } else if (isTransit) {
                cs.transitWagons += 1;
                cs.transitWeight += w.cargoWeight;
                transitWeight += w.cargoWeight;
            }

            totalTotalWagons += 1;
            totalTotalWeight += w.cargoWeight;
        });

        const cArray = Array.from(cargoMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);
        return {
            list: cArray,
            totalWeight: totalTotalWeight,
            totalWagons: totalTotalWagons,
            importWeight,
            transitWeight
        };
    }, [wagons, lang]);

    React.useEffect(() => {
        // Re-run purely to initialize missing vars in memo block scope above
    }, []);

    var totalTotalWeight = 0;
    var totalTotalWagons = 0;

    if (stats) {
        totalTotalWeight = stats.totalWeight;
        totalTotalWagons = stats.totalWagons;
    }

    // Visual Formats
    const topCargoPie = useMemo(() => {
        // Top 7 + Others
        const top = stats.list.slice(0, 7);
        const others = stats.list.slice(7);

        const mapped = top.map(c => ({
            name: c.name.length > 25 ? c.name.substring(0, 25) + "..." : c.name,
            value: c.totalWeight,
            wagons: c.totalWagons,
            code: c.code
        }));

        if (others.length > 0) {
            mapped.push({
                name: lang === 'uz' ? 'Boshqalar' : 'Прочие',
                value: others.reduce((acc, c) => acc + c.totalWeight, 0),
                wagons: others.reduce((acc, c) => acc + c.totalWagons, 0),
                code: 'OTHER'
            });
        }
        return mapped;
    }, [stats, lang]);

    const barData = useMemo(() => {
        // Take top 10 cargos for the comparative bar chart
        return stats.list.slice(0, 10).map(c => ({
            name: c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name,
            'Импорт': c.importWeight,
            'Транзит': c.transitWeight,
            originalName: c.name,
        }));
    }, [stats]);

    const toggleRow = (code: string) => {
        setExpandedRows(prev => ({ ...prev, [code]: !prev[code] }));
    };

    if (!wagons || wagons.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <PackageOpen className="w-16 h-16 text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">{t('not_found')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* 4 Cards Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-500/30 relative overflow-hidden group">
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 text-sm font-semibold mb-1">{lang === 'uz' ? 'Jami Yuk Hajmi' : 'Общий Объем Груза'}</p>
                            <h3 className="text-3xl font-black">{totalTotalWeight.toLocaleString()} <span className="text-lg font-bold text-blue-200">т</span></h3>
                        </div>
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            <Weight className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-blue-100 font-medium">
                        В <span className="text-white font-bold">{totalTotalWagons.toLocaleString()}</span> груженых вагонах
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 text-sm font-bold mb-1">{lang === 'uz' ? 'Top Yuk' : 'Топ Груз'}</p>
                            <h3 className="text-lg font-black text-slate-800 leading-tight">
                                {stats.list[0]?.name || '-'}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-emerald-50 rounded-xl">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                    <p className="text-sm font-bold tracking-tight text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg inline-flex w-fit">
                        {stats.list[0]?.totalWeight.toLocaleString()} т ({(stats.list[0]?.totalWeight / totalTotalWeight * 100).toFixed(1)}%)
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 text-sm font-bold mb-1">{t('import')}</p>
                            <h3 className="text-2xl font-black text-slate-800 leading-tight">
                                {stats.importWeight.toLocaleString()} <span className="text-sm text-slate-400 font-bold">т</span>
                            </h3>
                        </div>
                        <div className="p-2.5 bg-indigo-50 rounded-xl">
                            <Box className="w-5 h-5 text-indigo-500" />
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(stats.importWeight / totalTotalWeight) * 100}%` }}></div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-500 text-sm font-bold mb-1">{t('transit')}</p>
                            <h3 className="text-2xl font-black text-slate-800 leading-tight">
                                {stats.transitWeight.toLocaleString()} <span className="text-sm text-slate-400 font-bold">т</span>
                            </h3>
                        </div>
                        <div className="p-2.5 bg-amber-50 rounded-xl">
                            <Box className="w-5 h-5 text-amber-500" />
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(stats.transitWeight / totalTotalWeight) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Visual Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pie Chart: Cargo Breakdown */}
                <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <h3 className="text-lg font-black text-slate-800 mb-6">{lang === 'uz' ? 'Yuk turlari taqsimoti (og\'irlik bo\'yicha)' : 'Распределение родов груза (по весу)'}</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={topCargoPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {topCargoPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {topCargoPie.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                <span className="text-slate-700 font-bold truncate max-w-[100px]" title={entry.name}>{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bar Chart: Import vs Transit for Top Cargo */}
                <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        {lang === 'uz' ? 'Top yuklar dinamikasi (Tranzit / Import)' : 'Динамика топ-грузов (Транзит / Импорт)'}
                    </h3>
                    <div className="h-[320px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    angle={-25}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `${val / 1000}k`}
                                />
                                <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569', paddingTop: '10px' }} />
                                <Bar dataKey="Импорт" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Транзит" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Cargo Matrix Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        {lang === 'uz' ? 'Yuklar matritsasi va detallar' : 'Матрица грузов и детали'}
                    </h3>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        {stats.list.length} {lang === 'uz' ? 'xil mosyozuv' : 'уникальных записей'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-800">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">{t('cargo_col')}</th>
                                <th className="px-6 py-4 text-center">{lang === 'uz' ? 'Vagonlar' : 'Вагоны (Имп/Трн)'}</th>
                                <th className="px-6 py-4 text-center">{lang === 'uz' ? 'Import (t)' : 'Импорт (т)'}</th>
                                <th className="px-6 py-4 text-center">{lang === 'uz' ? 'Tranzit (t)' : 'Транзит (т)'}</th>
                                <th className="px-6 py-4 text-right">{t('total_weight')} (т) %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.list.map((c, idx) => {
                                const isExpanded = expandedRows[c.code];
                                const pct = (c.totalWeight / totalTotalWeight) * 100;

                                return (
                                    <React.Fragment key={c.code + '_' + idx}>
                                        <tr
                                            onClick={() => toggleRow(c.code)}
                                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button className="text-slate-400 group-hover:text-blue-500 transition-colors">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 text-xs">{c.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">{c.code}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 font-medium">
                                                {c.totalWagons} <span className="text-xs text-slate-400">({c.importWagons}/{c.transitWagons})</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`font-bold inline-block px-2 py-1 rounded-lg ${c.importWeight > 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
                                                    {c.importWeight > 0 ? c.importWeight.toLocaleString() : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`font-bold inline-block px-2 py-1 rounded-lg ${c.transitWeight > 0 ? 'bg-amber-50 text-amber-600' : 'text-slate-300'}`}>
                                                    {c.transitWeight > 0 ? c.transitWeight.toLocaleString() : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-slate-900">{c.totalWeight.toLocaleString()} <span className="text-slate-400 text-xs">т</span></span>
                                                    <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden" title={`${pct.toFixed(2)}%`}>
                                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Collapsible details for raw insight if necessary */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50 border-t border-slate-100">
                                                <td colSpan={5} className="px-14 py-4 p-4 text-xs">
                                                    <div className="flex gap-10">
                                                        <div className="space-y-2">
                                                            <p className="text-slate-500 font-bold uppercase">Импорт ({c.importWagons} ваг.)</p>
                                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                                {c.importWagons === 0 ? <span className="text-slate-400 italic">Нет импортных потоков</span> : <span className="font-mono font-bold text-indigo-600">{c.importWeight.toLocaleString()} т</span>}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-slate-500 font-bold uppercase">Транзит ({c.transitWagons} ваг.)</p>
                                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                                {c.transitWagons === 0 ? <span className="text-slate-400 italic">Нет транзитных потоков</span> : <span className="font-mono font-bold text-amber-600">{c.transitWeight.toLocaleString()} т</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CargoInfographics;
