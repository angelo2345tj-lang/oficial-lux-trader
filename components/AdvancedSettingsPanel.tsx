import React from 'react';
import { UserSettings } from '../types';
import {
  Shield,
  Cpu,
  Bell,
  Volume2,
  Vibrate,
  Gauge,
  Target,
  Zap,
  Sparkles,
  HardDrive,
} from 'lucide-react';

interface Props {
  settings: UserSettings;
  onChange: (next: UserSettings) => void;
  riskLevel: number;
  onRiskChange: (v: number) => void;
}

const Toggle = ({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    role="switch"
    aria-checked={active}
    className={`w-16 h-8 rounded-full relative cursor-pointer transition-all ${
      active ? 'bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-zinc-900'
    }`}
  >
    <div
      className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
        active ? 'left-9 shadow-lg' : 'left-1 shadow-md'
      }`}
    />
  </div>
);

const AdvancedSettingsPanel: React.FC<Props> = ({
  settings,
  onChange,
  riskLevel,
  onRiskChange,
}) => {
  const patch = (partial: Partial<UserSettings>) =>
    onChange({ ...settings, ...partial });

  const rows: {
    id: string;
    icon: React.ElementType;
    title: string;
    sub: string;
    active?: boolean;
    onClick?: () => void;
    slider?: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string };
  }[] = [
    {
      id: 'haptic',
      icon: Vibrate,
      title: 'Vibração premium',
      sub: 'Feedback tátil em sinais elite',
      active: settings.hapticFeedback,
      onClick: () => patch({ hapticFeedback: !settings.hapticFeedback }),
    },
    {
      id: 'sound',
      icon: Volume2,
      title: 'Som em notificações',
      sub: 'Alerta sonoro opcional',
      active: settings.soundEnabled,
      onClick: () => patch({ soundEnabled: !settings.soundEnabled }),
    },
    {
      id: 'notif',
      icon: Bell,
      title: 'Push em tempo real',
      sub: 'Ativo, direção, score e força IA',
      active: settings.notificationsEnabled,
      onClick: () => patch({ notificationsEnabled: !settings.notificationsEnabled }),
    },
    {
      id: 'anim',
      icon: Sparkles,
      title: 'Animações premium',
      sub: 'Transições e efeitos visuais',
      active: settings.animationsEnabled !== false,
      onClick: () =>
        patch({ animationsEnabled: settings.animationsEnabled === false }),
    },
    {
      id: 'cache',
      icon: HardDrive,
      title: 'Cache de mercado',
      sub: 'Acelera recarregamento de dados',
      active: settings.cacheEnabled !== false,
      onClick: () => patch({ cacheEnabled: settings.cacheEnabled === false }),
    },
    {
      id: 'autoai',
      icon: Cpu,
      title: 'IA automática',
      sub: 'Busca contínua sem travar o terminal',
      active: settings.autoAIScanEnabled === true,
      onClick: () => patch({ autoAIScanEnabled: !settings.autoAIScanEnabled }),
    },
    {
      id: 'aftergoal',
      icon: Target,
      title: 'Continuar após meta',
      sub: 'ON: opera após meta diária · OFF: solicita confirmação',
      active: settings.continueAfterDailyGoal !== false,
      onClick: () =>
        patch({ continueAfterDailyGoal: settings.continueAfterDailyGoal === false }),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5 pt-4">
        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/10">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-black italic uppercase tracking-tighter text-white text-glow">
            Configurações avançadas
          </h3>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-2 italic">
            Risco · IA · notificações · operação
          </p>
        </div>
      </div>

      <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/5 space-y-6 bg-[#050508]/60">
        <div className="flex items-center gap-5">
          <Gauge className="w-6 h-6 text-blue-500" />
          <div className="flex-1">
            <h4 className="text-[12px] font-black uppercase italic text-white">
              Gerenciamento de risco (%)
            </h4>
            <p className="text-[9px] text-zinc-600 uppercase mt-1">Por operação sobre a banca</p>
          </div>
          <span className="text-lg font-black mono text-blue-500">{riskLevel}%</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={riskLevel}
          onChange={(e) => {
            const v = Number(e.target.value);
            onRiskChange(v);
            patch({ riskPercent: v });
          }}
          className="w-full accent-blue-600"
        />
      </div>

      <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/5 space-y-5 bg-[#050508]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Zap className="w-6 h-6 text-amber-500" />
            <div>
              <h4 className="text-[12px] font-black uppercase italic text-white">Modo operacional</h4>
              <p className="text-[9px] text-zinc-600 uppercase mt-1">Conservador ou agressivo</p>
            </div>
          </div>
          <div className="flex bg-zinc-950 rounded-2xl p-1 border border-white/5">
            <button
              type="button"
              onClick={() => patch({ tradingStyle: 'conservative', aiSensitivity: 90 })}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${
                settings.tradingStyle !== 'aggressive'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600'
              }`}
            >
              Conservador
            </button>
            <button
              type="button"
              onClick={() => patch({ tradingStyle: 'aggressive', aiSensitivity: 85 })}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${
                settings.tradingStyle === 'aggressive'
                  ? 'bg-amber-600 text-white'
                  : 'text-zinc-600'
              }`}
            >
              Agressivo
            </button>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500 mb-2">
            <span>Limiar IA automática</span>
            <span className="text-blue-400">{settings.aiSensitivity ?? 90}%</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[80, 85, 90, 95].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => patch({ aiSensitivity: pct })}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border ${
                  (settings.aiSensitivity ?? 90) === pct
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-white/10 text-zinc-500'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <input
            type="range"
            min={80}
            max={95}
            step={5}
            value={settings.aiSensitivity ?? 90}
            onChange={(e) => patch({ aiSensitivity: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>
      </div>

      <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/5 space-y-4 bg-[#050508]/60">
        <div className="flex items-center gap-4">
          <Target className="w-6 h-6 text-emerald-500" />
          <div>
            <h4 className="text-[12px] font-black uppercase italic text-white">Horário operacional (UTC)</h4>
            <p className="text-[9px] text-zinc-600 uppercase mt-1">IA automática respeita a janela</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-[9px] font-black uppercase text-zinc-500">
            Início
            <input
              type="number"
              min={0}
              max={23}
              value={settings.tradingHourStart ?? 0}
              onChange={(e) => patch({ tradingHourStart: Number(e.target.value) })}
              className="mt-2 w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
            />
          </label>
          <label className="text-[9px] font-black uppercase text-zinc-500">
            Fim
            <input
              type="number"
              min={0}
              max={23}
              value={settings.tradingHourEnd ?? 23}
              onChange={(e) => patch({ tradingHourEnd: Number(e.target.value) })}
              className="mt-2 w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white font-mono text-sm"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="glass-morphism p-6 rounded-[2rem] border border-white/5 flex items-center justify-between gap-4 bg-[#050508]/40"
          >
            <div className="flex items-center gap-4 min-w-0">
              <row.icon className="w-6 h-6 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-[11px] font-black uppercase italic text-white truncate">
                  {row.title}
                </h4>
                <p className="text-[9px] text-zinc-600 uppercase mt-1 truncate">{row.sub}</p>
              </div>
            </div>
            {row.slider ? (
              <div className="w-32 shrink-0">
                <input
                  type="range"
                  min={row.slider.min}
                  max={row.slider.max}
                  step={row.slider.step}
                  value={row.slider.value}
                  onChange={(e) => row.slider!.onChange(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            ) : (
              <Toggle active={!!row.active} onClick={row.onClick!} />
            )}
          </div>
        ))}
      </div>

      <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/5 bg-[#050508]/60 flex items-center gap-4">
        <Target className="w-6 h-6 text-green-500 shrink-0" />
        <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-bold italic">
          Meta diária e stop diário permanecem na seção Safe Lift. Limiar IA automática padrão: 90%.
        </p>
      </div>
    </div>
  );
};

export default AdvancedSettingsPanel;
