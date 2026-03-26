import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Beaker, Plus, AlertCircle, Settings } from 'lucide-react';
import { CustomProtocolRule, CustomProtocolType, getCustomProtocols, saveCustomProtocols, identifyTrainProtocol, TRAIN_PROTOCOL_RULES } from '../../utils/trainProtocols';
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

  const mgspOptions = [
    ...Object.keys(TRAIN_PROTOCOL_RULES),
    "ПРОЧИЕ"
  ];

  useEffect(() => {
    setRules(getCustomProtocols());
  }, []);

  const handleAddRule = () => {
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

    const newRule: CustomProtocolRule = {
      id: Date.now().toString(),
      index: key,
      type: newType,
      mgsp: newMgsp
    };

    const updated = [...rules, newRule];
    setRules(updated);
    saveCustomProtocols(updated);
    
    // Reset Add Form
    setNewIndexFrom('');
    setNewIndexTo('');
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    saveCustomProtocols(updated);
  };

  const handleTest = () => {
    const res = identifyTrainProtocol(testInput);
    setTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Protocol Rules Manager</h3>
              <p className="text-xs text-slate-500 font-medium tracking-tight">Test and overlay custom Train API Junction bindings without code edits.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column: Manage Rules */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" /> Add Custom Rule Override
              </h4>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">From Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 7200"
                    value={newIndexFrom}
                    onChange={e => setNewIndexFrom(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono border-b-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">To Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 6980"
                    value={newIndexTo}
                    onChange={e => setNewIndexTo(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono border-b-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Junction / Point</label>
                  <select
                    value={newMgsp}
                    onChange={e => setNewMgsp(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold border-b-2"
                  >
                    {mgspOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Protocol Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as CustomProtocolType)}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold border-b-2"
                  >
                    <option value="qabul">QABUL (Acceptance)</option>
                    <option value="topshirish">TOPSHIRISH (Handover)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddRule}
                disabled={!newIndexFrom || !newIndexTo}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" /> Save Active Rule
              </button>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Active Custom Rules
              </h4>
              <p className="text-xs text-slate-500 mb-4 tracking-tight">Rules defined here override the core source code system dynamically on page reload.</p>
              
              {rules.length === 0 ? (
                <div className="text-center text-xs text-slate-400 p-4 border border-dashed border-slate-200 rounded-lg italic bg-slate-50/50">
                  No custom protocol overrides in use.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm transition-all group">
                      <div>
                        <div className="font-mono font-bold text-slate-700 text-sm tracking-widest">{rule.index}</div>
                        <div className="text-[10px] font-bold mt-0.5">
                          <span className={rule.type === 'qabul' ? 'text-emerald-600' : 'text-rose-600'}>
                            {rule.type.toUpperCase()}
                          </span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="text-slate-600">{rule.mgsp}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-0 group-hover:opacity-100 transition-all font-medium"
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
          <div className="bg-slate-900 rounded-xl shadow-inner border border-slate-800 overflow-hidden flex flex-col">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-2">
              <Beaker className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-slate-200 text-sm tracking-wider">PROTOCOL TEST CONSOLE</h4>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wider">TARGET TRAIN CONSIST INDEX</label>
              <textarea
                className="w-full bg-slate-950/50 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none transition-all placeholder:text-slate-700"
                rows={4}
                placeholder="Paste protocol: (6980+05+7200)"
                value={testInput}
                onChange={e => { setTestInput(e.target.value); setTestResult(null); }}
              ></textarea>
              
              <button
                onClick={handleTest}
                disabled={!testInput}
                className="mt-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-slate-900 font-bold font-mono text-sm rounded-xl transition-all w-full tracking-widest flex items-center justify-center gap-2"
              >
                EXECUTE_TEST()
              </button>

              <div className="mt-8">
                <label className="block text-xs font-mono font-bold text-slate-500 mb-2 uppercase tracking-wider">EVALUATION OUTPUT</label>
                <div className="bg-slate-950 rounded-xl border border-slate-800 h-28 p-4 font-mono text-sm flex flex-col justify-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-800"></div>
                  
                  {testResult === null ? (
                    <span className="text-slate-600">waiting for input...</span>
                  ) : testResult === null || Object.keys(testResult).length === 0 ? (
                    <div>
                      <span className="text-amber-500 font-bold">WARNING: No Match Found</span>
                      <br />
                      <span className="text-slate-500 text-xs mt-1 block">Train index does not bind to any Qabul or Topshirish rules. System will fallback to "ПРОЧИЕ" or ignore.</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Match Type:</span>
                        <span className={`font-bold uppercase tracking-widest ${testResult.type === 'qabul' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          [{testResult.type}]
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-2 border-dashed">
                        <span className="text-slate-400">Junction (Border):</span>
                        <span className="font-bold text-cyan-400 font-sans tracking-wide">
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
