
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  Info, 
  BarChart3, 
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Users
} from 'lucide-react';
import { RawSubscriptionRow, CohortStats } from './types';
import { processSubscriptionData, formatCohortName } from './services/dataProcessor';
import { generateCohortExcel } from './services/excelGenerator';
import { HeatmapCell } from './components/HeatmapCell';
import { GoogleGenAI } from "@google/genai";
import { saveLastImport, loadLastImport } from './services/firebase';

const App: React.FC = () => {
  const [data, setData] = useState<RawSubscriptionRow[]>([]);
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Começa true para checar Firebase
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'abs' | 'perc'>('perc');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Carregar dados globais ao iniciar (permite que qualquer usuário veja a última planilha)
  useEffect(() => {
    const initApp = async () => {
      try {
        const savedData = await loadLastImport();
        if (savedData && Array.isArray(savedData)) {
          setData(savedData);
          setStats(processSubscriptionData(savedData));
          setIsSynced(true);
        }
      } catch (err) {
        console.error("Falha na inicialização:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setIsSynced(false);
    setError(null);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) throw new Error("Falha ao ler o conteúdo do arquivo.");
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
        
        if (!jsonData || jsonData.length === 0) throw new Error("Planilha sem dados válidos.");
        
        const rawData = jsonData as RawSubscriptionRow[];
        setData(rawData);
        setStats(processSubscriptionData(rawData));
        
        // Sincronizar com Firebase para que outros usuários vejam
        const success = await saveLastImport(rawData);
        if (success) setIsSynced(true);
        else setError("Dados processados, mas falha na sincronização em nuvem. Verifique as permissões do Firebase.");
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const generateAIInsight = async () => {
    if (!stats) return;
    setIsAnalysing(true);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("Chave de IA não configurada no ambiente.");
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analise estes cohorts SaaS da AdvEasy. Resuma em 3 pontos: retenção média e tendências recentes. Dados: ${stats.cohorts.slice(-5).map(c => `${c.cohort}: ${c.totalStarters} contratos, Média: ${(c.average*100).toFixed(2)}%`).join(', ')}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiAnalysis(response.text || "Sem insights disponíveis no momento.");
    } catch (err: any) {
      setAiAnalysis("Erro na IA: " + err.message);
    } finally {
      setIsAnalysing(false);
    }
  };

  const monthsHeader = Array.from({ length: 25 }, (_, i) => `Mês ${i}`);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#0B1E33] p-2 rounded-xl shadow-lg"><BarChart3 className="w-6 h-6 text-white" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[#0B1E33] uppercase leading-none">Analytics Hub</h1>
              {isSynced && (
                <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 border border-emerald-100 shadow-sm">
                  <Check className="w-3 h-3" /> Base Global Ativa
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#B28A1E] font-black uppercase tracking-widest mt-1">AdvEasy Data Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <button onClick={() => generateCohortExcel(data, stats, [])} className="flex items-center gap-2 bg-[#B28A1E] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:brightness-110 transition-all">
              <Download className="w-4 h-4" /> Exportar XLSX
            </button>
          )}
          <label className="flex items-center gap-2 bg-[#0B1E33] text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer shadow-md active:scale-95 transition-transform">
            <Upload className="w-4 h-4" /> Nova Importação
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in zoom-in duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-bold">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-[#B28A1E] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Buscando dados no Firebase...</p>
          </div>
        ) : !stats ? (
          <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-200 text-center shadow-xl border-b-[10px] border-[#0B1E33]">
             <FileSpreadsheet className="w-16 h-16 text-slate-200 mb-6" />
             <h2 className="text-2xl font-black text-[#0B1E33] mb-4 uppercase">Nenhuma Base Encontrada</h2>
             <p className="text-slate-400 max-w-sm mb-8 font-medium">Não há dados salvos na nuvem. Importe uma planilha para começar o compartilhamento global.</p>
             <label className="bg-[#0B1E33] text-white px-10 py-4 rounded-2xl font-black text-sm cursor-pointer shadow-xl uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
               Importar Primeira Base
               <input type="file" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setViewMode('perc')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'perc' ? 'bg-[#0B1E33] text-white shadow-md' : 'text-slate-500'}`}>Percentual %</button>
                  <button onClick={() => setViewMode('abs')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'abs' ? 'bg-[#0B1E33] text-white shadow-md' : 'text-slate-500'}`}>Absoluto N</button>
                </div>
                {isSynced && <div className="hidden md:flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase">
                  <Users className="w-4 h-4" /> Visível para todos
                </div>}
              </div>
              <button onClick={generateAIInsight} disabled={isAnalysing} className="flex items-center gap-2 text-white font-black text-[10px] px-6 py-3 bg-[#0B1E33] rounded-xl uppercase tracking-widest hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-lg">
                {isAnalysing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Insights IA
              </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden border-b-[12px] border-[#0B1E33]">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#0B1E33]">
                      <th className="sticky left-0 z-20 bg-[#0B1E33] p-4 text-left text-[10px] font-black text-white uppercase border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.1)] min-w-[120px]">Cohort</th>
                      <th className="p-4 text-center text-[10px] font-black text-white uppercase border-r border-slate-800">Contratos</th>
                      {monthsHeader.map(m => <th key={m} className="p-4 text-center text-[10px] font-black text-white uppercase border-r border-slate-800 min-w-[85px]">{m}</th>)}
                      <th className="p-4 text-center text-[10px] font-black text-[#B28A1E] uppercase bg-slate-900/40 min-w-[100px]">Média</th>
                      <th className="p-4 text-center text-[10px] font-black text-[#B28A1E] uppercase bg-slate-900/40 min-w-[100px]">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cohorts.map(row => (
                      <tr key={row.cohort} className="hover:bg-slate-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-4 text-[11px] font-black text-[#0B1E33] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{formatCohortName(row.cohort)}</td>
                        <td className="bg-slate-50/50 border-b border-r border-slate-200 p-4 text-[11px] text-center font-bold text-slate-500">{row.totalStarters}</td>
                        {row.retention.map((val, idx) => (
                          <td key={idx} className="p-0">
                            <HeatmapCell 
                              value={viewMode === 'perc' ? (row.totalStarters > 0 ? val / row.totalStarters : 0) : val}
                              percentage={viewMode === 'perc'}
                              baseValue={row.totalStarters}
                            />
                          </td>
                        ))}
                        <td className="bg-slate-50 border-b border-r border-slate-200 p-4 text-[11px] text-center font-black text-[#0B1E33]">{(row.average * 100).toFixed(2)}%</td>
                        <td className="bg-slate-50 border-b border-r border-slate-200 p-4 text-[11px] text-center">
                          {row.growth > 0 ? <span className="text-emerald-600 font-black flex items-center justify-center gap-1"><ArrowUpRight className="w-3 h-3"/> {(row.growth * 100).toFixed(1)}%</span> : row.growth < 0 ? <span className="text-rose-600 font-black flex items-center justify-center gap-1"><ArrowDownRight className="w-3 h-3"/> {(row.growth * 100).toFixed(1)}%</span> : <span className="text-slate-400 font-bold">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {aiAnalysis && (
              <div className="bg-[#0B1E33] text-white p-8 rounded-[2rem] shadow-xl border-l-[12px] border-[#B28A1E] animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-black text-lg uppercase mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#B28A1E]" /> Diagnóstico de Retenção</h3>
                <div className="text-sm font-medium text-slate-300 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span>AdvEasy Analytics Hub</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Firebase Live</span>
          <span className="text-slate-200">|</span>
          <span>v3.0 Stable</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
