import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Beaker, Plus, AlertCircle, Settings } from 'lucide-react';
import { CustomProtocolRule, CustomProtocolType, getCustomProtocols, loadCustomProtocolsAsync, addCustomProtocolAsync, deleteCustomProtocolAsync, identifyTrainProtocol, TRAIN_PROTOCOL_RULES } from '../../utils/trainProtocols';
import { Language } from '../../types';

interface Props {
  onClose: () => void;
  lang: Language;
  t: (key: string) => string;
}

const ProtocolManagerModal: React.FC<Props> = ({ onClose, lang, t }) => {
  const [rules, setRules] = useState<CustomProtocolRule[]>([]);
  const [newIndexFrom, setNewIndexFrom] = useState('');
  const [newIndexTo, setNewIndexTo] = useState('');
  const [newType, setNewType] = useState<CustomProtocolType>('topshirish');
  const [newMgsp, setNewMgsp] = useState<string>('САРЫАГАЧ');
  
  // Test workbench state
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ mgsp: string, type: string } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const mgspOptions = [
    ...Object.keys(TRAIN_PROTOCOL_RULES),
    "ПРОЧИЕ"
  ];

  useEffect(() => {
    // Load local cache immediately
    setRules(getCustomProtocols());
    // Fetch from backend
    setLoading(true);
    loadCustomProtocolsAsync().then((fetched) => {
      setRules(fetched);
    }).finally(() => setLoading(false));
  }, []);

  const handleAddRule = async () => {
    if (!newIndexFrom || !newIndexTo || newIndexFrom.length < 4 || newIndexTo.length < 4) {
      alert("Please enter exactly valid 4-6 digit station codes.");
      return;
    }

    const key = `${newIndexFrom.substring(0,4)}-${newIndexTo.substring(0,4)}`;
    
    // Check if it already exists
    if (rules.some(r => r.index === key)) {
      alert("This Train index rule already exists! Delete the old one first.");
      return;
    }

    try {
      setIsSaving(true);
      const newRulePayload = {
        index: key,
        type: newType,
        mgsp: newMgsp,
        createdBy: 'Admin', // If we have currentUser, could be passed in
      };

      await addCustomProtocolAsync(newRulePayload);
      
      // Refresh local state from cache
      setRules(getCustomProtocols());
      
      // Reset Add Form
      setNewIndexFrom('');
      setNewIndexTo('');
    } catch (e: any) {
      alert(`Error saving rule: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      setIsSaving(true);
      await deleteCustomProtocolAsync(id);
      // Refresh local state from cache
      setRules(getCustomProtocols());
    } catch (e: any) {
      alert(`Error deleting rule: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    const res = identifyTrainProtocol(testInput);
    setTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-900/10 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-white/50 relative">
        {/* Header */}
        <div className="px-8 py-5 border-b border-indigo-50/80 flex justify-between items-center bg-gradient-to-r from-slate-50/90 to-white backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Protocol Rules Manager</h3>
              <p className="text-sm text-slate-500 font-medium">Dynamically override Train API Junction bindings.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all hover:rotate-90 duration-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column: Manage Rules */}
          <div className="space-y-6 md:col-span-7 flex flex-col">
            <div className="bg-white p-6 rounded-2xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>
              <h4 className="font-extrabold text-slate-800 mb-5 flex items-center gap-2 text-lg">
                <div className="bg-emerald-50 p-1.5 rounded-lg"><Plus className="w-4 h-4 text-emerald-600" /></div>
                Add Rule Override
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">From Station Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 7200"
                    value={newIndexFrom}
                    onChange={e => setNewIndexFrom(e.target.value)}
                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono font-medium text-slate-800 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">To Station Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 6980"
                    value={newIndexTo}
                    onChange={e => setNewIndexTo(e.target.value)}
                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-mono font-medium text-slate-800 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Border Junction</label>
                  <select
                    value={newMgsp}
                    onChange={e => setNewMgsp(e.target.value)}
                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                    {mgspOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Protocol Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as CustomProtocolType)}
                    className="w-full bg-slate-50/50 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="qabul">QABUL (Acceptance)</option>
                    <option value="topshirish">TOPSHIRISH (Handover)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddRule}
                disabled={!newIndexFrom || !newIndexTo || isSaving}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-slate-300 disabled:to-slate-400 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                <Save className="w-5 h-5" /> {isSaving ? 'Saving...' : 'Deploy Active Rule'}
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-indigo-50 shadow-sm flex-1 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>
              <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2 text-lg">
                <div className="bg-amber-50 p-1.5 rounded-lg"><AlertCircle className="w-4 h-4 text-amber-500" /></div>
                Deployed Rules
              </h4>
              <p className="text-xs text-slate-500 font-medium mb-5">These rules dynamically override source mappings on runtime.</p>
              
              {rules.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                    <Trash2 className="w-5 h-5 text-slate-300" />
                  </div>
                  <span className="text-sm font-bold text-slate-400">No Custom Rules Active</span>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-2 styled-scrollbar flex-1 relative">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all group/item">
                      <div>
                        <div className="font-mono font-black text-slate-800 text-[15px] tracking-widest">{rule.index}</div>
                        <div className="flex items-center gap-2 mt-1 -ml-1">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${rule.type === 'qabul' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {rule.type}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">{rule.mgsp}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={isSaving}
                        className="mt-3 sm:mt-0 p-2 text-slate-400 hover:text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/30 rounded-xl sm:opacity-0 group-hover/item:opacity-100 transition-all font-medium disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Workbench Test Console */}
          <div className="md:col-span-5 bg-[#0f111a] rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] border border-slate-800 overflow-hidden flex flex-col relative before:absolute before:inset-0 before:bg-[url('https://transparenttextures.com/patterns/cubes.png')] before:opacity-[0.03] before:z-0">
            {/* Terminal Header */}
            <div className="bg-[#1a1d27] px-6 py-4 border-b border-slate-800/80 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-cyan-400" />
                <h4 className="font-bold text-slate-200 outline-none select-none text-[11px] tracking-[0.2em]">PROTOCOL_DEBUGGER</h4>
              </div>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
              </div>
            </div>
            
            {/* Terminal Body */}
            <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
              <label className="block text-[10px] font-mono font-medium text-slate-400/80 mb-3 uppercase tracking-[0.1em]">Test String (Raw Consist)</label>
              <textarea
                className="w-full bg-[#131620] text-emerald-400 font-mono text-sm p-5 rounded-2xl border border-slate-800/80 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none resize-none transition-all placeholder:text-slate-700 shadow-inner"
                rows={4}
                placeholder="Paste protocol: (6980+05+7200)"
                value={testInput}
                onChange={e => { setTestInput(e.target.value); setTestResult(null); }}
              ></textarea>
              
              <button
                onClick={handleTest}
                disabled={!testInput}
                className="mt-5 py-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 disabled:border-slate-800 disabled:bg-slate-800/20 disabled:text-slate-600 text-cyan-300 font-bold font-mono text-xs rounded-2xl transition-all w-full tracking-[0.15em] flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
              >
                EXECUTE_BINDING()
              </button>

              <div className="mt-auto pt-8">
                <div className="bg-[#131620] rounded-2xl border border-slate-800/80 p-5 font-mono text-sm flex flex-col justify-center min-h-[140px] shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-slate-800 to-slate-700 transition-colors group-hover:from-cyan-500 group-hover:to-cyan-600"></div>
                  
                  {testResult === null ? (
                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                      <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse"></div>
                      Awaiting query execution...
                    </div>
                  ) : testResult === null || Object.keys(testResult).length === 0 ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <span className="text-amber-500 text-xs font-black bg-amber-500/10 px-2 py-1 rounded inline-block mb-2">ERR_NOT_FOUND</span>
                      <p className="text-slate-500 text-[11px] leading-relaxed">No matching ProtocolRule mapped to this pattern. System returns <span className="text-slate-400 font-bold">fallback (ПРОЧИЕ)</span> logic for this trace.</p>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-500 text-[10px] tracking-widest uppercase">Match Type</span>
                        <span className={`px-2 py-1 rounded border font-black text-[10px] uppercase tracking-widest ${testResult.type === 'qabul' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                          {testResult.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
                        <span className="text-slate-500 text-[10px] tracking-widest uppercase">Junction Point</span>
                        <span className="font-extrabold text-cyan-300 font-sans tracking-wide text-sm bg-cyan-900/30 px-3 py-1 rounded-lg border border-cyan-800/50">
                          {testResult.mgsp}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProtocolManagerModal;
