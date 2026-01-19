
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
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
        
        if (jsonData.length === 0) {
          throw new Error("O arquivo está vazio ou não pôde ser lido.");
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
      setError("Erro na leitura do arquivo.");
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleDownloadExcel = () => {
    if (!stats || data.length === 0) return;
    
    const now = new Date();
    const keys = Object.keys(data[0]);
    const startKey = keys.find(k => k.toLowerCase().includes('iniciou')) || keys[18];
    const cancelKey = keys.find(k => k.toLowerCase().includes('cancelou')) || keys[21];

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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Aja como um Analista de Dados Sênior da AdvEasy. Analise os dados de retenção SaaS e forneça 3 insights estratégicos em Português.
        Dados formatados:
        ${stats.cohorts.slice(-6).map(c => `${c.cohort}: ${c.totalStarters} starters, Média: ${(c.average*100).toFixed(2)}%, Crescimento: ${(c.growth*100).toFixed(2)}%`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setAiAnalysis(response.text || "Não foi possível gerar a análise.");
    } catch (err) {
      setAiAnalysis("Erro ao conectar com a IA.");
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
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header with AdvEasy Identity */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#0B1E33] p-2 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0B1E33] leading-none">Analytics Hub</h1>
            <p className="text-[10px] text-[#B28A1E] font-bold uppercase tracking-widest mt-1">SaaS Cohort Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <button 
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 bg-[#B28A1E] hover:bg-[#9a771a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Relatório (.xlsx)
            </button>
          )}
          <label className="flex items-center gap-2 bg-[#0B1E33] hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            Importar
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!stats && !isLoading && (
          <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="bg-slate-50 p-6 rounded-full mb-6">
              <FileSpreadsheet className="w-16 h-16 text-[#0B1E33]/20" />
            </div>
            <h2 className="text-2xl font-bold text-[#0B1E33] mb-2">Análise de Retenção AdvEasy</h2>
            <p className="text-slate-500 max-w-md mb-8">
              Suba sua exportação de assinaturas para visualizar o heatmap de retenção e calcular automaticamente a média e o crescimento dos seus cohorts.
            </p>
            <div className="flex gap-4">
               <label className="bg-[#0B1E33] text-white px-8 py-3 rounded-xl font-bold cursor-pointer hover:scale-105 transition-transform shadow-lg">
                  Começar agora
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
               </label>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
            <RefreshCw className="w-12 h-12 text-[#B28A1E] animate-spin mb-4" />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">Processando Inteligência de Dados</p>
          </div>
        )}

        {stats && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('perc')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'perc' ? 'bg-[#0B1E33] shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Percentual (%)
                  </button>
                  <button 
                    onClick={() => setViewMode('abs')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'abs' ? 'bg-[#0B1E33] shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Absoluto (N)
                  </button>
                </div>
                <div className="h-6 w-[1px] bg-slate-200"></div>
                <span className="text-[10px] text-[#B28A1E] font-extrabold uppercase tracking-widest">
                  {stats.cohorts.length} Cohorts Ativos
                </span>
              </div>

              <button 
                onClick={generateAIInsight}
                disabled={isAnalysing}
                className="flex items-center gap-2 text-white font-bold text-xs px-5 py-2.5 bg-[#0B1E33] rounded-lg transition-all hover:bg-black shadow-md disabled:opacity-50"
              >
                {isAnalysing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                Insights Estratégicos IA
              </button>
            </div>

            {/* Matrix View - Custom Scrollbar and Identical to Reference */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#0B1E33]">
                      <th className="sticky left-0 z-20 bg-[#0B1E33] p-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-b border-r border-slate-700 min-w-[100px]">
                        Mês Cohort
                      </th>
                      <th className="p-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-b border-r border-slate-700 min-w-[100px]">
                        Tamanho (Iniciados)
                      </th>
                      {monthsHeader.map((m) => (
                        <th key={m} className="p-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-b border-r border-slate-700 min-w-[70px]">
                          {m}
                        </th>
                      ))}
                      <th className="p-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-b border-r border-slate-700 min-w-[80px] bg-slate-800">
                        Média
                      </th>
                      <th className="p-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-b border-r border-slate-700 min-w-[90px] bg-slate-800">
                        Crescimento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cohorts.map((row) => (
                      <tr key={row.cohort} className="hover:bg-slate-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-3 text-[10px] font-bold text-[#0B1E33]">
                          {formatCohortName(row.cohort)}
                        </td>
                        <td className="bg-slate-50 border-b border-r border-slate-200 p-3 text-[11px] text-center font-bold text-slate-700">
                          {row.totalStarters}
                        </td>
                        {row.retention.map((val, idx) => (
                          <td key={idx} className="p-0 min-w-[70px]">
                            <HeatmapCell 
                              value={viewMode === 'perc' ? (row.retention[0] > 0 ? val / row.retention[0] : 0) : val}
                              percentage={viewMode === 'perc'}
                              baseValue={row.retention[0]}
                            />
                          </td>
                        ))}
                        <td className="bg-[#f8fafc] border-b border-r border-slate-200 p-3 text-[11px] text-center font-bold text-[#0B1E33]">
                          {(row.average * 100).toFixed(2)}%
                        </td>
                        <td className="bg-[#f8fafc] border-b border-r border-slate-200 p-3 text-[11px] text-center font-bold">
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
              <div className="bg-[#0B1E33] text-white p-8 rounded-3xl shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 duration-700 border-t-4 border-[#B28A1E]">
                <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                  <div className="bg-[#B28A1E] p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">Análise Executiva AdvEasy</h3>
                </div>
                <div className="text-sm leading-relaxed prose prose-invert max-w-none whitespace-pre-wrap font-medium">
                  {aiAnalysis}
                </div>
              </div>
            )}
            
            {/* Legend & Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <Info className="w-5 h-5 text-[#B28A1E]" />
                    <h3 className="font-bold text-[#0B1E33]">Dicionário de Métricas</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Média</p>
                       <p className="text-xs text-slate-700">Média aritmética da retenção (%) de todos os meses do cohort.</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Crescimento</p>
                       <p className="text-xs text-slate-700">Diferença entre a média do cohort atual vs o cohort anterior.</p>
                    </div>
                  </div>
               </div>

               <div className="bg-[#0B1E33] p-6 rounded-2xl flex items-center justify-between text-white border-l-8 border-[#B28A1E]">
                  <div>
                    <h3 className="font-bold text-lg mb-1">Pronto para Exportar?</h3>
                    <p className="text-xs text-slate-400">Gere o arquivo consolidado com Média e Crescimento.</p>
                  </div>
                  <button 
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-2 bg-[#B28A1E] hover:bg-[#9a771a] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Download className="w-5 h-5" />
                    Baixar Excel
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">AdvEasy Data Science Unit</span>
        <div className="flex gap-4 items-center">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           <span className="text-[10px] text-slate-400 font-bold">SISTEMA ATIVO</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
