import React, { useState } from 'react';
import { 
  BookOpen, Download, ShieldCheck, Zap, Target, 
  Info, Lock, Activity, BarChart2, ShieldAlert,
  ChevronDown, Trophy, Cpu, Microscope, Search, 
  Layers, Waves, TrendingUp, Gauge, ArrowRightLeft,
  LayoutGrid, Bell, HelpCircle
} from 'lucide-react';

const ManualView: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>('indicators');

  const indicators = [
    { name: 'RSI (Força Relativa)', desc: 'Detecta exaustão de compradores/vendedores e possíveis zonas de reversão.', icon: TrendingUp },
    { name: 'MACD (Convergência)', desc: 'Filtra o momentum e confirma a direção da tendência macro.', icon: Waves },
    { name: 'VWAP (Preço Médio)', desc: 'Identifica o preço justo institucional, servindo como ímã para o mercado.', icon: Target },
    { name: 'HFT Volume (Algoritmos)', desc: 'Capta entradas massivas de robôs de alta frequência e agressão institucional.', icon: Activity },
    { name: 'Order Blocks (SMC)', desc: 'Mapeia zonas de oferta e demanda onde os grandes bancos deixaram ordens pendentes.', icon: Lock },
    { name: 'Fair Value Gap (FVG)', desc: 'Identifica vácuos de liquidez (desequilíbrios) que o mercado tende a preencher.', icon: Layers },
    { name: 'EMA Cross (20/50/200)', desc: 'Cruza médias exponenciais para validar o início de novas micro-tendências.', icon: ArrowRightLeft },
    { name: 'Bollinger Bands', desc: 'Mede a compressão e expansão da volatilidade para prever explosões de preço.', icon: Search },
    { name: 'ATR (Volatilidade)', desc: 'Ajusta automaticamente a distância do Stop Loss com base no ruído do mercado.', icon: Gauge },
    { name: 'ADX (Força da Tendência)', desc: 'Garante que o sinal só seja disparado em mercados com tendência definida.', icon: TrendingUp },
    { name: 'BOS / CHOCH (Estrutura)', desc: 'Valida a quebra de estrutura ou mudança de caráter do mercado (Trend Change).', icon: LayoutGrid },
    { name: 'Ichimoku Cloud', desc: 'Filtra a nuvem de suporte/resistência dinâmica para evitar falsos rompimentos.', icon: Search },
  ];

  const sections = [
    {
      id: 'operate',
      icon: Zap,
      title: 'Como operar',
      subtitle: 'Fluxo institucional no terminal',
      content: (
        <div className="space-y-4 text-[10px] text-zinc-400 leading-relaxed">
          <ol className="list-decimal ml-4 space-y-2">
            <li>Selecione ativo e timeframe; confira sessão e fuso no hub global.</li>
            <li>Use <strong>Analisar</strong> ou ative <strong>IA automática</strong> para busca contínua.</li>
            <li>Valide score IA, força operacional, entrada, SL e TP antes de executar.</li>
            <li>Registre a operação no histórico para estatísticas e ROI reais.</li>
            <li>Respeite meta diária e stop diário (Safe Lift) — você pode continuar manualmente após o alerta.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'signals',
      icon: BarChart2,
      title: 'Interpretar sinais',
      subtitle: 'Score, direção e confluências',
      content: (
        <div className="space-y-3 text-[10px] text-zinc-400">
          <p><strong className="text-white">CALL / PUT</strong> — direção sugerida pela IA com base em estrutura e fluxo.</p>
          <p><strong className="text-white">Score IA (%)</strong> — convergência estatística; quanto maior, mais alinhado o setup.</p>
          <p><strong className="text-white">Força operacional</strong> — FRACA, MODERADA, FORTE ou ELITE; priorize FORTE/ELITE.</p>
          <p><strong className="text-white">Modo instantâneo</strong> — entradas mais rápidas; <strong>confirmado</strong> exige mais confluência.</p>
        </div>
      ),
    },
    {
      id: 'risk',
      icon: ShieldAlert,
      title: 'Gerenciamento de risco',
      subtitle: 'Capital, lote e limites diários',
      content: (
        <div className="space-y-3 text-[10px] text-zinc-400">
          <p>Defina sua banca real em Configurações e o percentual de risco por operação.</p>
          <p>Use meta diária e stop diário para disciplina; o sistema alerta sem bloquear permanentemente.</p>
          <p>Nunca arrisque mais de 2% por setup em contas conservadoras; modo agressivo exige experiência.</p>
        </div>
      ),
    },
    {
      id: 'ai',
      icon: Cpu,
      title: 'IA operacional',
      subtitle: 'Assertividade sem travas artificiais',
      content: (
        <div className="space-y-3 text-[10px] text-zinc-400">
          <p>A IA analisa estrutura, liquidez, RSI, ensemble e validação Gemini/local.</p>
          <p>Não há score mínimo fixo obrigatório — setups fracos ou fakeouts em modo confirmado são filtrados.</p>
          <p>Ajuste <strong>sensibilidade</strong> e modo conservador/agressivo em Configurações avançadas.</p>
        </div>
      ),
    },
    {
      id: 'pwa',
      icon: Download,
      title: 'Instalação PWA',
      subtitle: 'Terminal na tela inicial',
      content: (
        <div className="space-y-4">
          <p className="text-[10px] text-zinc-400">Instale como app para menor latência e experiência fullscreen.</p>
          <ol className="text-[9px] space-y-2 list-decimal ml-4 text-zinc-400">
            <li>Chrome/Safari → compartilhar ou menu (⋮)</li>
            <li><strong>Adicionar à tela de início</strong></li>
            <li>Abra pelo ícone Lux Trader FX na home</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'notif',
      icon: Bell,
      title: 'Notificações push',
      subtitle: 'Sinais em tempo real',
      content: (
        <div className="space-y-3 text-[10px] text-zinc-400">
          <p>Ative notificações e som em Configurações; o navegador pedirá permissão na primeira vez.</p>
          <p>Cada alerta inclui ativo, direção, score IA e força operacional.</p>
          <p>Vibração premium opcional em sinais de alta qualidade.</p>
        </div>
      ),
    },
    {
      id: 'faq',
      icon: HelpCircle,
      title: 'Perguntas frequentes',
      subtitle: 'Respostas rápidas',
      content: (
        <div className="space-y-4 text-[9px] text-zinc-500 uppercase font-bold tracking-wide">
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
            <p className="text-blue-400 mb-1">Token inválido?</p>
            <p className="normal-case text-zinc-400 font-medium">Solicite licença ao administrador ou suporte oficial.</p>
          </div>
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
            <p className="text-blue-400 mb-1">API offline?</p>
            <p className="normal-case text-zinc-400 font-medium">Execute npm run dev na pasta do projeto (frontend + backend).</p>
          </div>
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
            <p className="text-blue-400 mb-1">Histórico sumiu?</p>
            <p className="normal-case text-zinc-400 font-medium">Dados ficam no dispositivo (IndexedDB + localStorage). Não limpe cache do navegador.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'indicators',
      icon: Microscope,
      title: 'Os 12 Pilares Quantitativos',
      subtitle: 'A ciência por trás da nossa precisão institucional',
      content: (
        <div className="space-y-8">
          <p className="text-[10px] text-zinc-400 leading-relaxed italic">
            O algoritmo <strong>Lux Trader FX</strong> não opera baseado em um único fator. Ele exige a convergência de no mínimo 8 dos 12 indicadores abaixo para validar um sinal.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {indicators.map((ind, idx) => (
              <div key={idx} className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-3 group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                    <ind.icon className="w-4 h-4" />
                  </div>
                  <h6 className="text-[10px] font-black text-white uppercase italic tracking-tighter">{ind.name}</h6>
                </div>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider leading-relaxed">
                  {ind.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="p-5 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-center">
            <p className="text-[9px] font-black text-blue-400 uppercase italic">Confluência LUX: A matemática vencendo a intuição.</p>
          </div>
        </div>
      )
    },
    {
      id: 'hud',
      icon: Activity,
      title: 'Interpretando a Telemetria',
      subtitle: 'Entenda os dados do seu Painel HUD',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[7px] font-black text-zinc-600 uppercase block mb-1">LATENCY (MS)</span>
              <p className="text-[10px] text-blue-400 font-bold">Tempo de resposta entre o terminal e os nós da Lux Cloud.</p>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
              <span className="text-[7px] font-black text-zinc-600 uppercase block mb-1">SCORE LUX (%)</span>
              <p className="text-[10px] text-zinc-400 font-bold">Probabilidade estatística baseada em confluências históricas.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'safelift',
      icon: ShieldCheck,
      title: 'Safe Lift: Trava de Segurança',
      subtitle: 'A inteligência que protege seu capital',
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
               <Trophy className="w-6 h-6 text-green-500" />
               <div className="flex-1">
                  <h6 className="text-[10px] font-black text-green-500 uppercase">Meta Diária (Target)</h6>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold">Protege você da ganância.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
               <ShieldAlert className="w-6 h-6 text-red-500" />
               <div className="flex-1">
                  <h6 className="text-[10px] font-black text-red-500 uppercase">Stop Diário (Protection)</h6>
                  <p className="text-[8px] text-zinc-500 uppercase font-bold">Impede que um dia ruim destrua sua conta.</p>
               </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-3xl mx-auto pb-48 animate-in fade-in duration-700">
      <div className="flex flex-col items-center text-center space-y-5">
        <div className="p-5 bg-blue-600/10 rounded-full border border-blue-500/20">
          <BookOpen className="w-10 h-10 text-blue-500" />
        </div>
        <div>
          <h2 className="text-4xl font-black uppercase italic text-white tracking-tighter">Manual do Operador</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Protocolos de Elite Lux Trader FX</p>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="glass-morphism rounded-[2.5rem] overflow-hidden border border-white/5 transition-all hover:border-blue-500/20 shadow-xl">
            <button 
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              className="w-full p-8 flex items-center justify-between text-left transition-all"
            >
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl border transition-all ${openSection === section.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-black/40 border-white/10 text-zinc-600'}`}>
                   <section.icon className="w-6 h-6" />
                </div>
                <div>
                   <span className={`text-[12px] font-black uppercase tracking-widest block italic leading-none ${openSection === section.id ? 'text-white' : 'text-zinc-400'}`}>
                     {section.title}
                   </span>
                   <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1.5 block leading-none">
                     {section.subtitle}
                   </span>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-zinc-700 transition-transform duration-500 ${openSection === section.id ? 'rotate-180 text-blue-500' : ''}`} />
            </button>
            
            {openSection === section.id && (
              <div className="px-10 pb-10">
                <div className="h-px w-full bg-white/5 mb-8"></div>
                <div className="bg-black/30 p-8 rounded-[2rem] border border-white/5">
                   {section.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-600/5 border border-blue-500/10 p-8 rounded-[3rem] flex gap-5">
        <Info className="w-6 h-6 text-blue-500 shrink-0" />
        <p className="text-[10px] font-medium text-zinc-400 leading-relaxed italic">
          Documentação institucional Lux Trader FX — uso da plataforma, IA, histórico e gestão de risco.
          Consulte o administrador do terminal para licenças e acesso.
        </p>
      </div>
    </div>
  );
};

export default ManualView;