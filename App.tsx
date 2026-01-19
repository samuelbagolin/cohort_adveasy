
import React, { useState } from 'react';
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
  Minus
} from 'lucide-react';
import { RawSubscriptionRow, CohortStats } from './types';
import { processSubscriptionData, formatCohortName } from './services/dataProcessor';
import { generateCohortExcel } from './services/excelGenerator';
import { HeatmapCell } from './components/HeatmapCell';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [data, setData] = useState<RawSubscriptionRow[]>([]);
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'abs' | 'perc'>('perc');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalysing, setIsAnalysing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) throw new Error("Falha ao ler o conteúdo do arquivo.");
        
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
        
        if (!jsonData || jsonData.length === 0) {
          throw new Error("O arquivo está vazio ou não pôde ser lido corretamente.");
        }

        setData(jsonData as RawSubscriptionRow[]);
        const processedStats = processSubscriptionData(jsonData as RawSubscriptionRow[]);
        setStats(processedStats);
      } catch (err: any) {
        setError("Erro ao processar arquivo: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Erro na leitura física do arquivo.");
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleDownloadExcel = () => {
    if (!stats || data.length === 0) return;
    
    const now = new Date();
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    const startKey = keys.find(k => k.toLowerCase().includes('iniciou')) || keys[18] || 'Iniciou';
    const cancelKey = keys.find(k => k.toLowerCase().includes('cancelou')) || keys[21] || 'Cancelou';

    const processedWithTenure = data.map(row => {
        const parseDateSimple = (val: any) => {
           if (val instanceof Date) return val;
           if (!val) return null;
           const d = new Date(val);
           return isNaN(d.getTime()) ? null : d;
        };

        const sd = parseDateSimple(row[startKey]);
        const cd = parseDateSimple(row[cancelKey]);
        let tenure = 0;
        if (sd) {
           if (!cd) {
             tenure = Math.floor((now.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24 * 30)) + 1;
           } else {
             tenure = Math.floor((cd.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24 * 30));
           }
        }

        return {
           originalData: row,
           cohortMonth: sd ? sd.toISOString().slice(0, 7) : 'Unknown',
           tenureMonths: tenure
        };
    });

    generateCohortExcel(data, stats, processedWithTenure);
  };

  const generateAIInsight = async () => {
    if (!stats) return;
    setIsAnalysing(true);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key não configurada.");
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Aja como um Analista de Dados Sênior da AdvEasy. Analise os dados de retenção SaaS e forneça 3 insights estratégicos curtos em Português.
        Dados formatados:
        ${stats.cohorts.slice(-6).map(c => `${c.cohort}: ${c.totalStarters} starters, Média: ${(c.average*100).toFixed(2)}%, Crescimento: ${(c.growth*100).toFixed(2)}%`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAiAnalysis(response.text || "Análise concluída, mas sem texto gerado.");
    } catch (err: any) {
      setAiAnalysis("Erro ao conectar com a IA: " + err.message);
    } finally {
      setIsAnalysing(false);
    }
  };

  const monthsHeader = Array.from({ length: 25 }, (_, i) => `Mês ${i}`);

  const GrowthIndicator = ({ value }: { value: number }) => {
    if (value > 0.0001) return <div className="flex items-center gap-1 text-emerald-600 font-bold"><ArrowUpRight className="w-3 h-3"/> {(value * 100).toFixed(2)}%</div>;
    if (value < -0.0001) return <div className="flex items-center gap-1 text-rose-600 font-bold"><ArrowDownRight className="w-3 h-3"/> {(value * 100).toFixed(2)}%</div>;
    return <div className="flex items-center gap-1 text-slate-400 font-bold"><Minus className="w-3 h-3"/> 0.00%</div>;
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header with AdvEasy Identity */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#0B1E33] p-2 rounded-xl shadow-inner">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#0B1E33] leading-none tracking-tight">Analytics Hub</h1>
            <p className="text-[10px] text-[#B28A1E] font-extrabold uppercase tracking-[0.2em] mt-1">AdvEasy Data Science</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <button 
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 bg-[#B28A1E] hover:bg-[#9a771a] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              Relatório (.xlsx)
            </button>
          )}
          <label className="flex items-center gap-2 bg-[#0B1E33] hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95">
            <Upload className="w-4 h-4" />
            Importar Dados
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-in fade-in zoom-in duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-semibold">{error}</div>
          </div>
        )}

        {!stats && !isLoading && (
          <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-sm border-b-8 border-b-[#0B1E33]">
            <div className="bg-[#f8fafc] p-10 rounded-full mb-8 shadow-inner">
              <FileSpreadsheet className="w-20 h-20 text-[#0B1E33]/30" />
            </div>
            <h2 className="text-3xl font-black text-[#0B1E33] mb-4">Métricas de Retenção</h2>
            <p className="text-slate-500 max-w-lg mb-10 text-lg leading-relaxed">
              Visualize a saúde das suas assinaturas AdvEasy através de uma análise de cohort profissional com heatmap integrado.
            </p>
            <label className="bg-[#0B1E33] text-white px-10 py-4 rounded-2xl font-black text-sm cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl uppercase tracking-widest">
              Começar análise agora
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {isLoading && (
          <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="relative">
               <div className="w-20 h-20 border-4 border-slate-100 rounded-full border-t-[#B28A1E] animate-spin"></div>
               <BarChart3 className="absolute inset-0 m-auto w-8 h-8 text-[#0B1E33]" />
            </div>
            <p className="mt-8 text-slate-400 font-black uppercase tracking-widest text-xs">Sincronizando Inteligência</p>
          </div>
        )}

        {stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-5">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setViewMode('perc')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-tight ${viewMode === 'perc' ? 'bg-[#0B1E33] shadow-lg text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Percentual (%)
                  </button>
                  <button 
                    onClick={() => setViewMode('abs')}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-tight ${viewMode === 'abs' ? 'bg-[#0B1E33] shadow-lg text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Absoluto (N)
                  </button>
                </div>
                <div className="h-8 w-[2px] bg-slate-200 hidden md:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Status da Base</span>
                  <span className="text-sm text-[#B28A1E] font-black uppercase tracking-widest mt-1">
                    {stats.cohorts.length} Cohorts Ativos
                  </span>
                </div>
              </div>

              <button 
                onClick={generateAIInsight}
                disabled={isAnalysing}
                className="flex items-center gap-3 text-white font-black text-xs px-6 py-3 bg-[#0B1E33] rounded-2xl transition-all hover:bg-slate-900 shadow-lg active:scale-95 disabled:opacity-50 uppercase tracking-widest"
              >
                {isAnalysing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Insights com IA
              </button>
            </div>

            {/* Matrix View */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col border-b-8 border-b-[#0B1E33]">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#0B1E33]">
                      <th className="sticky left-0 z-20 bg-[#0B1E33] p-4 text-left text-[11px] font-black text-white uppercase tracking-widest border-b border-r border-slate-800 min-w-[120px]">
                        Cohort
                      </th>
                      <th className="p-4 text-center text-[11px] font-black text-white uppercase tracking-widest border-b border-r border-slate-800 min-w-[100px]">
                        Tamanho
                      </th>
                      {monthsHeader.map((m) => (
                        <th key={m} className="p-4 text-center text-[11px] font-black text-white uppercase tracking-widest border-b border-r border-slate-800 min-w-[80px]">
                          {m}
                        </th>
                      ))}
                      <th className="p-4 text-center text-[11px] font-black text-[#B28A1E] uppercase tracking-widest border-b border-r border-slate-800 min-w-[90px] bg-slate-900/50">
                        Média
                      </th>
                      <th className="p-4 text-center text-[11px] font-black text-[#B28A1E] uppercase tracking-widest border-b border-r border-slate-800 min-w-[100px] bg-slate-900/50">
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cohorts.map((row) => (
                      <tr key={row.cohort} className="hover:bg-slate-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-4 text-xs font-black text-[#0B1E33]">
                          {formatCohortName(row.cohort)}
                        </td>
                        <td className="bg-slate-50/50 border-b border-r border-slate-200 p-4 text-xs text-center font-black text-slate-600">
                          {row.totalStarters}
                        </td>
                        {row.retention.map((val, idx) => (
                          <td key={idx} className="p-0 min-w-[80px]">
                            <HeatmapCell 
                              value={viewMode === 'perc' ? (row.retention[0] > 0 ? val / row.retention[0] : 0) : val}
                              percentage={viewMode === 'perc'}
                              baseValue={row.retention[0]}
                            />
                          </td>
                        ))}
                        <td className="bg-slate-50 border-b border-r border-slate-200 p-4 text-xs text-center font-black text-[#0B1E33]">
                          {(row.average * 100).toFixed(2)}%
                        </td>
                        <td className="bg-slate-50 border-b border-r border-slate-200 p-4 text-xs text-center font-black">
                          <GrowthIndicator value={row.growth} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Analysis Result */}
            {aiAnalysis && (
              <div className="bg-[#0B1E33] text-white p-10 rounded-[2rem] shadow-2xl space-y-6 animate-in slide-in-from-bottom-8 duration-700 border-l-[12px] border-[#B28A1E]">
                <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
                  <div className="bg-[#B28A1E] p-3 rounded-2xl shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-black text-2xl tracking-tighter uppercase">Executive Analysis</h3>
                </div>
                <div className="text-base leading-relaxed prose prose-invert max-w-none whitespace-pre-wrap font-medium text-slate-300">
                  {aiAnalysis}
                </div>
              </div>
            )}
            
            {/* Footer Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-16">
               <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-[#B28A1E]/10 p-2.5 rounded-xl">
                      <Info className="w-5 h-5 text-[#B28A1E]" />
                    </div>
                    <h3 className="font-black text-[#0B1E33] uppercase tracking-widest text-sm">Legenda Executiva</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Retenção Média</p>
                       <p className="text-xs text-slate-700 font-medium">Consistência do cohort ao longo de todo o período monitorado.</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Crescimento (Trend)</p>
                       <p className="text-xs text-slate-700 font-medium">Variação da performance média comparada ao mês anterior.</p>
                    </div>
                  </div>
               </div>

               <div className="bg-[#0B1E33] p-8 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between text-white border-r-8 border-[#B28A1E] shadow-xl">
                  <div className="text-center sm:text-left mb-6 sm:mb-0">
                    <h3 className="font-black text-xl mb-2 tracking-tight">Exportação Direta</h3>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Excel configurado para BI</p>
                  </div>
                  <button 
                    onClick={handleDownloadExcel}
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#B28A1E] hover:bg-white hover:text-[#B28A1E] text-white px-10 py-4 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 uppercase tracking-widest"
                  >
                    <Download className="w-5 h-5" />
                    Baixar XLSX
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-[#0B1E33]" />
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">AdvEasy Analytics Division</span>
        </div>
        <div className="flex gap-8 items-center">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-500 font-black tracking-widest">SYSTEM ONLINE</span>
           </div>
           <span className="text-[10px] text-slate-300 font-black">v2.1.4</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
