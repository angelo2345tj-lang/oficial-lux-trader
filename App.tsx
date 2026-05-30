import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useReducer,
} from "react";

import PremiumSplash from "./components/PremiumSplash";
import AdvancedSettingsPanel from "./components/AdvancedSettingsPanel";
import ShareTokenImageCard from "./components/ShareTokenImageCard";
import { shareTokenImage, buildTokenShareText } from "./utils/shareToken";
import { useAutoAIScan } from "./hooks/useAutoAIScan";
import {
  shouldShowSplash,
  markSplashComplete,
  markOnboardingComplete,
} from "./services/sessionPersistence";

import {
  ASSETS,
  TIMEFRAMES,
  TRANSLATIONS,
  MARKET_SESSIONS,
  CURRENCIES,
  LANGUAGES,
  CHART_TIMEZONES,
} from "./constants";

import {
  Asset,
  TradeSignal,
  TradeHistoryItem,
  User,
  UserSettings,
  SignalType,
  SupportedLanguage,
  MarketSession
} from "./types";

import AdminPanel from "./components/AdminPanel";
import ManualView from "./components/ManualView";
import HistoryPanel from "./components/HistoryPanel";
import SaveOperationModal from "./components/SaveOperationModal";
import SignalIdealPopup from "./components/SignalIdealPopup";
import Logo from "./components/Logo";
import PremiumTerminal from "./components/PremiumTerminal";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useExecution } from "./context/ExecutionContext";
import { analyzeSignal, API_ENABLED, cancelPendingAnalysis } from "./services/api/signalsApi";
import {
  subscribeInstitutionalSignalStream,
  setInstitutionalScannerRunning,
  markClientAnalyzedSnapshot,
} from "./services/api/institutionalStream";
import {
  isValidInstitutionalPayload,
  isValidSignalResult,
  normalizeCommittedSignal,
  resetAssetInstitutionalState,
} from "./services/institutional/institutionalCommit";
import { resolveSnapshotId } from "./services/institutional/snapshotId";
import {
  normalizeBlockReasonCode,
  logBlockReasonUi,
  shouldSkipAutoReanalysis,
} from "./services/institutional/blockReasonUI";
import { isAssetMarketClosed } from "./services/institutional/marketHours";
import { INSTITUTIONAL_SIGNALS_ONLY, shouldAutoRefreshFromCandles } from "./services/institutional/institutionalMode";
import { SignalTimingMode } from "./types";
import {
  loadFavoriteAssets,
  loadFavoriteTimeframes,
  toggleFavoriteAsset,
  toggleFavoriteTimeframe,
} from "./services/userPreferences";
import { DEFAULT_USER_SETTINGS } from "./constants/defaults";
import {
  loadHistory,
  saveHistory,
  subscribeHistoryStorage,
} from "./services/storage/operationalHistoryDb";

import { useWebSocket } from "./hooks/useWebSocket";
import { candleStreamService } from "./services/websocket/candleStreamService";
import { realtimeOrchestrator } from "./services/realtime/bootstrapRealtime";
import { analysisLifecycle } from "./services/realtime/analysisLifecycle";
import { globalAnalysisLock } from "./services/analysis/globalAnalysisLock";
import {
  canStartAnalysis,
  markAnalysisStarted,
  resetAnalysisDebounce,
} from "./services/analysis/institutionalDebounce";
import { ANALYSIS_TIMEOUT_MS } from "./services/realtime/realtimeConfig";
import { onSignalPipeline } from "./services/signal/signalPipeline";
import { persistSignal, invalidateSignal } from "./src/state/signalStore";
import { fetchCandles, getProviderForSymbol } from "./services/marketData";
import { logger } from "./services/logger";

import {
  isIdealSignal,
  sendDeviceNotification,
  triggerHaptic,
  requestNotificationPermission,
  ensureNotificationPermission,
  notifyDailyGoalReached,
  notifyDailyStopReached,
  notifyOperationSaved,
  notifyConfirmedSignal,
} from "./services/notificationService";

import {
  LayoutDashboard,
  History,
  LogOut,
  Settings,
  Loader2,
  ShieldCheck,
  X,
  ChevronDown,
  Shield,
  SunMedium,
  Moon,
  Globe,
  BookOpen,
  Save,
  CircleCheck,
  User as UserIcon,
  ShieldAlert,
  Trophy,
  Volume2,
  Bell,
  Coins,
  Camera,
  Search,
  Clock,
  CheckCircle2,
  Sliders,
  Info,
  Trash2,
  ArrowRight,
  ExternalLink,
  Lock,
  Wallet,
  Languages as LanguageIcon,
  Share2,
  Copy,
} from "lucide-react";

const SFX = {
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  SIGNAL: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  ALERT: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'
};

const FuturisticBg = ({ theme }: { theme: 'dark' | 'light' }) => {
  const [stars, setStars] = useState<{ id: number, top: string, left: string, size: number, delay: string, opacity: number, color: string }[]>([]);
  
  useEffect(() => {
    const starColors = ['#ffffff', '#cbd5e1', '#3b82f6', '#93c5fd', '#bae6fd'];
    const newStars = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 0.3,
      delay: `${Math.random() * 8}s`,
      opacity: Math.random() * 0.7 + 0.2,
      color: starColors[Math.floor(Math.random() * starColors.length)]
    }));
    setStars(newStars);
  }, []);

  return (
    <div className={`stars-container ${theme === 'light' ? 'light-mode' : ''}`}>
      {theme === 'dark' && (
        <>
          <div className="nebula nebula-blue"></div>
          <div className="nebula nebula-purple"></div>
          <div className="nebula nebula-cyan"></div>
        </>
      )}
      
      <div className="grid-overlay"></div>
      
      {stars.map(star => (
        <div 
          key={star.id} 
          className="star" 
          style={{ 
            top: star.top, 
            left: star.left, 
            width: `${star.size}px`, 
            height: `${star.size}px`, 
            backgroundColor: star.color,
            opacity: star.opacity,
            animation: `twinkle 6s infinite ease-in-out ${star.delay}`,
            boxShadow: star.size > 1.8 ? `0 0 ${star.size * 4}px ${star.color}` : 'none'
          }} 
        />
      ))}
      
      <div className="stardust-layer"></div>
      <div className="vignette"></div>
      <div className="scanline"></div>
    </div>
  );
};

const BootSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const steps = [
    "INITIALIZING CORE KERNEL...",
    "SYNCING WITH LUX NODES...",
    "ESTABLISHING QUANTUM LINK...",
    "BYPASSING INSTITUTIONAL FIREWALLS...",
    "DECRYPTING HFT STREAM...",
    "OPTIMIZING VISUAL ENGINE...",
    "ACCESS GRANTED."
  ];

  useEffect(() => {
    if (step < steps.length) {
      const timer = setTimeout(() => setStep(s => s + 1), 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[2000] bg-[#020204] flex flex-col items-center justify-center p-6 overflow-hidden">
      <FuturisticBg theme="dark" />
      
      <div className="relative animate-in zoom-in-50 duration-1000 flex flex-col items-center">
        <Logo className="w-40 h-40 mb-16" animate={true} showText={false} />
        <div className="absolute inset-0 bg-blue-500/20 blur-[120px] rounded-full animate-pulse"></div>
        
        <div className="w-full max-w-[300px] space-y-4 relative z-10">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out shadow-[0_0_20px_#3b82f6]"
              style={{ width: `${(step / steps.length) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-black text-blue-500 tracking-[0.4em] animate-pulse italic">
              {steps[Math.min(step, steps.length - 1)]}
            </span>
            <span className="text-[9px] font-black text-zinc-600 mono">
              {Math.floor((step / steps.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-[8px] font-black text-zinc-800 tracking-[1.5em] uppercase italic opacity-20">
        LUX TRADER PROTOCOL v9.0.2
      </div>
    </div>
  );
};

const SafeLiftAlert = ({
  type,
  onClose,
  onContinueTrading,
  t,
}: {
  type: 'GOAL' | 'STOP';
  onClose: () => void;
  onContinueTrading: () => void;
  t: typeof TRANSLATIONS.pt_BR;
}) => {
  useEffect(() => {
    const audio = new Audio(SFX.ALERT);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-1000">
      <div className={`w-full max-w-sm glass-morphism p-12 rounded-[4rem] text-center space-y-10 border-2 ${type === 'GOAL' ? 'border-green-500/40 shadow-[0_0_100px_rgba(34,197,94,0.3)]' : 'border-red-500/40 shadow-[0_0_100px_rgba(239,68,68,0.3)]'}`}>
        <div className={`w-32 h-32 mx-auto rounded-[2.5rem] flex items-center justify-center shadow-inner ${type === 'GOAL' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
          {type === 'GOAL' ? <Trophy className="w-16 h-16 animate-bounce" /> : <ShieldAlert className="w-16 h-16 animate-pulse" />}
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white text-glow">
            {type === 'GOAL' ? t.dailyGoal : t.dailyStop}
          </h2>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed px-6 italic">
             {type === 'GOAL' ? t.safeLockDesc : t.safeLockDesc}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinueTrading}
          className="w-full py-7 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-[12px] tracking-[0.35em] shadow-2xl transition-all active:scale-95 border-b-6 border-blue-800 italic"
        >
          CONTINUAR OPERANDO
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-5 bg-white/10 hover:bg-white/15 text-zinc-300 rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] transition-all border border-white/10 italic"
        >
          PAUSAR — RECONHECER PROTOCOLO
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const execution = useExecution();
  const [loading, setLoading] = useState(() => shouldShowSplash());
const [isInitializing] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'history' | 'settings' | 'admin' | 'manual'>(() => (localStorage.getItem('lux_last_view') as any) || 'dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('lux_theme') as any) || 'dark');
  const [activePicker, setActivePicker] = useState<'asset' | 'tf' | 'currency' | 'language' | null>(null);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [safeLiftAlert, setSafeLiftAlert] = useState<'GOAL' | 'STOP' | null>(null);
  const [safeLiftOverride, setSafeLiftOverride] = useState(() => {
    try {
      return localStorage.getItem('lux_safe_lift_override') === new Date().toDateString();
    } catch {
      return false;
    }
  });
  const [signalTimingMode, setSignalTimingMode] = useState<SignalTimingMode>(() => {
    const saved = localStorage.getItem('lux_signal_timing_mode');
    return saved === 'CONFIRMED' ? 'CONFIRMED' : 'INSTANT';
  });
  const [winProbability, setWinProbability] = useState<number | undefined>(undefined);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [historyEditItem, setHistoryEditItem] = useState<TradeHistoryItem | null>(null);
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>(() => loadFavoriteAssets());
  const [favoriteTimeframes, setFavoriteTimeframes] = useState<string[]>(() =>
    loadFavoriteTimeframes()
  );
  const analyzeLockRef = useRef(false);
  const scannerRunningRef = useRef(false);
  const lastSignalRef = useRef<TradeSignal | null>(null);
  const analysisSessionRef = useRef(0);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const scanSourceRef = useRef<'manual' | 'auto'>('manual');
  const shareTokenRef = useRef<HTMLDivElement>(null);
  const [sharingToken, setSharingToken] = useState(false);
  const lastNotifiedSignalIdRef = useRef<string | null>(null);
  const [idealPopupSignal, setIdealPopupSignal] = useState<TradeSignal | null>(null);
  const [idealWinProb, setIdealWinProb] = useState<number | undefined>(undefined);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanBlockCode, setScanBlockCode] = useState<string | null>(null);
  const lastAutoBlockRef = useRef<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('lux_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  
  const [accessIdInput, setAccessIdInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('lux_settings');
      return saved
        ? { ...DEFAULT_USER_SETTINGS, ...JSON.parse(saved) }
        : DEFAULT_USER_SETTINGS;
    } catch {
      return DEFAULT_USER_SETTINGS;
    }
  });

  const t = useMemo(
    () => TRANSLATIONS[settings.language] ?? TRANSLATIONS.pt_BR,
    [settings.language]
  );

  const [disabledAssets, setDisabledAssets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lux_disabled_assets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('lux_disabled_assets');
        if (saved) setDisabledAssets(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const defaultAsset =
    ASSETS.find((a) => a.symbol === 'BTCUSD') ??
    ASSETS.find((a) => !disabledAssets.includes(a.symbol)) ??
    ASSETS[0];

  const [selectedAsset, setSelectedAsset] = useState<Asset>(() => {
    try {
      const saved = localStorage.getItem('lux_selected_asset');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = ASSETS.find(a => a.symbol === parsed.symbol);
        if (found && !disabledAssets.includes(found.symbol)) return found;
      }
    } catch (e) {}
    return defaultAsset;
  });
  
  const [selectedTimeframe, setSelectedTimeframe] = useState(() => localStorage.getItem('lux_selected_tf') || '60');
  const [userBanca, setUserBanca] = useState<number>(() => {
    const saved = localStorage.getItem('lux_user_banca');
    return saved ? Number(saved) : settings.userBanca;
  });
  const [riskLevel, setRiskLevel] = useState(() => {
    const saved = localStorage.getItem('lux_risk_level');
    return saved ? Number(saved) : settings.riskPercent;
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSignal, setCurrentSignal] = useState<TradeSignal | null>(null);
  const [history, setHistory] = useState<TradeHistoryItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);

  const { price: livePrice, status: wsStatus, marketLive } = useWebSocket(
    selectedAsset.symbol,
    selectedTimeframe
  );
  const displayWsStatus =
    marketLive && (wsStatus === 'stale' || wsStatus === 'disconnected') ? 'fallback' : wsStatus;
  const [dataProvider, setDataProvider] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('lux_signal_timing_mode', signalTimingMode);
  }, [signalTimingMode]);

  useEffect(() => {
    const sym = selectedAsset.symbol;
    const tf = selectedTimeframe;
    cancelPendingAnalysis(sym, tf);
    resetAssetInstitutionalState(sym, tf);
    setCurrentSignal(null);
    setScanError(null);
    setWinProbability(undefined);
    lastSignalRef.current = null;

    setDataProvider(getProviderForSymbol(sym));
    fetchCandles(sym, tf, 80)
      .then(() => realtimeOrchestrator.markRestAlive())
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Erro candles';
        logger.error(msg, 'App');
        if (msg.includes('Sem provider') || msg.includes('NO_PROVIDER')) {
          setCurrentSignal(null);
          setScanError('SEM DADOS — configure TwelveData para este ativo');
        }
      });
  }, [selectedAsset.symbol, selectedTimeframe]);

  const playSFX = useCallback((url: string) => {
    if (!settings.soundEnabled) return;
    const audio = new Audio(url);
    audio.volume = 0.25;
    audio.play().catch(() => {});
  }, [settings.soundEnabled]);

  const changeView = (view: any) => {
    if (view !== currentView) {
      playSFX(SFX.CLICK);
      setCurrentView(view);
    }
  };

  useEffect(() => { localStorage.setItem('lux_last_view', currentView); }, [currentView]);
  useEffect(() => { localStorage.setItem('lux_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('lux_selected_asset', JSON.stringify(selectedAsset)); }, [selectedAsset]);
  useEffect(() => { localStorage.setItem('lux_selected_tf', selectedTimeframe); }, [selectedTimeframe]);
  useEffect(() => { localStorage.setItem('lux_user_banca', userBanca.toString()); }, [userBanca]);
  useEffect(() => { localStorage.setItem('lux_risk_level', riskLevel.toString()); }, [riskLevel]);
  useEffect(() => {
    // Force reset all locks and debounce on app startup
    console.log('[TRACE] APP STARTUP: forcing all locks reset');
    scannerRunningRef.current = false;
    analyzeLockRef.current = false;
    setInstitutionalScannerRunning(false);
    resetAnalysisDebounce();
    // Force release global lock even if not running
    globalAnalysisLock.release('done');
    console.log('[TRACE] APP STARTUP: locks reset complete');
    
    loadHistory()
      .then((items) => {
        setHistory(items);
        setHistoryReady(true);
      })
      .catch(() => setHistoryReady(true));
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    const timer = window.setTimeout(() => {
      saveHistory(history).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [history, historyReady]);

  useEffect(() => subscribeHistoryStorage(() => {
    loadHistory().then(setHistory).catch(() => undefined);
  }), []);
  useEffect(() => { localStorage.setItem('lux_settings', JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'historico') setCurrentView('history');
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'historico') changeView('history');
      else if (h === 'dashboard' || h === '') changeView('dashboard');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (currentView === 'history') window.location.hash = 'historico';
    else if (currentView === 'dashboard') window.location.hash = 'dashboard';
  }, [currentView]);

  const todayProfit = useMemo(() => history
    .filter(item => new Date(item.timestamp).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + curr.profit, 0), [history]);

  const isGoalReached = useMemo(() => {
    const target = settings.dailyGoalType === 'percent' ? (userBanca * (settings.dailyGoalValue / 100)) : settings.dailyGoalValue;
    return todayProfit >= target && target > 0;
  }, [todayProfit, settings, userBanca]);

  const isStopReached = useMemo(() => {
    const limit = settings.dailyStopLossType === 'percent' ? (userBanca * (settings.dailyStopLoss / 100)) : settings.dailyStopLoss;
    return Math.abs(todayProfit) >= limit && todayProfit < 0 && limit > 0;
  }, [todayProfit, settings, userBanca]);

  useEffect(() => {
    if (safeLiftOverride) return;
    if (isGoalReached && !safeLiftAlert) {
      setSafeLiftAlert('GOAL');
      if (settings.notificationsEnabled) {
        requestNotificationPermission().then((ok) => {
          if (ok) notifyDailyGoalReached('Meta diária atingida', true);
        });
      }
    }
    if (isStopReached && !safeLiftAlert) {
      setSafeLiftAlert('STOP');
      if (settings.notificationsEnabled) {
        requestNotificationPermission().then((ok) => {
          if (ok) notifyDailyStopReached('Stop diário atingido', true);
        });
      }
    }
  }, [isGoalReached, isStopReached, safeLiftAlert, safeLiftOverride, settings.notificationsEnabled]);

  const continueAfterSafeLift = useCallback(() => {
    const today = new Date().toDateString();
    localStorage.setItem('lux_safe_lift_override', today);
    setSafeLiftOverride(true);
    setSafeLiftAlert(null);
    setGlobalSuccess('PROTOCOLO LIBERADO — OPERAÇÃO MANUAL ATIVA');
    setTimeout(() => setGlobalSuccess(null), 3000);
  }, []);

  const [currentTimeUTC, setCurrentTimeUTC] = useState(new Date().getUTCHours());
  const [currentMinuteUTC, setCurrentMinuteUTC] = useState(new Date().getUTCMinutes());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeUTC(now.getUTCHours());
      setCurrentMinuteUTC(now.getUTCMinutes());
    }, 1000); 
    return () => clearInterval(timer);
  }, []);

  const isSessionOpen = (session: MarketSession) => {
    const now = currentTimeUTC;
    if (session.openUTC < session.closeUTC) {
      return now >= session.openUTC && now < session.closeUTC;
    } else {
      return now >= session.openUTC || now < session.closeUTC;
    }
  };

  const handleSelectSession = (session: any) => {
    playSFX(SFX.CLICK);
    setSettings({ ...settings, timezone: session.timezone });
    setGlobalSuccess(`SINC: ${session.name.toUpperCase()}`);
    setTimeout(() => setGlobalSuccess(null), 3000);
    setIsHubOpen(false);
  };

  useEffect(() => {
    const body = document.body;
    if (theme === 'light') body.classList.add('light-mode');
    else body.classList.remove('light-mode');
  }, [theme]);

  const finalizeAnalysis = useCallback(() => {
    console.log('[Lux:UI] finalizeAnalysis called - scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current);
    setIsAnalyzing(false);
    analyzeLockRef.current = false;
    scannerRunningRef.current = false;
    setInstitutionalScannerRunning(false);
    // Force reset debounce to allow immediate next analysis
    console.log('[Lux:UI] forcing debounce reset');
    resetAnalysisDebounce();
    console.log('[Lux:UI] analyzing false');
    console.log('[Lux:UI] scanner idle');
    console.log('[Lux:UI] flags reset - scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current);
  }, []);

  const commitUiSignal = useCallback(
    (signal: TradeSignal, winProb?: number, snapshotId?: string) => {
      console.log('[Lux:UI] commitUiSignal called - signal.asset=', signal.asset, ' signal.type=', signal.type, ' signal.score=', signal.score);
      console.log(
        '[AUDIT-COMMIT]',
        {
          signalId: signal.id,
          previousSignalId: lastSignalRef.current?.id,
          sameObject: signal === lastSignalRef.current
        }
      );
      const canonicalSnap = resolveSnapshotId(snapshotId, signal.id);
      if (!canonicalSnap) {
        console.warn('[Lux:UI] commit rejected — missing canonical snapshotId', signal.asset);
        setCurrentSignal(null);
        invalidateSignal();
        return;
      }

      const payload = {
        signal,
        symbol: signal.asset,
        status: 'OK' as const,
        confidence: signal.confidence ?? signal.score,
        snapshotId: canonicalSnap,
        direction: signal.type === SignalType.BUY ? 'BUY' as const : signal.type === SignalType.SELL ? 'SELL' as const : 'NEUTRAL' as const,
        timestamp: new Date().toISOString(),
        snapshotTimestamp: Date.now(),
        marketSequence: 0,
        timeframe: selectedTimeframe,
      };

      if (!isValidInstitutionalPayload(payload, selectedAsset.symbol)) {
        console.warn('[Lux:UI] commit rejected — invalid institutional payload');
        setCurrentSignal(null);
        invalidateSignal();
        return;
      }

      const next = normalizeCommittedSignal(signal);
      lastSignalRef.current = next;
      persistSignal(next, true);
      setCurrentSignal(next);
      setScanError(null);
      if (winProb != null) setWinProbability(winProb);
      console.log('[Lux:UI] calling finalizeAnalysis from commitUiSignal');
      finalizeAnalysis();
      forceRender();
      console.log('[Lux:UI] signal committed', next.type, next.confidence);
    },
    [finalizeAnalysis, selectedAsset.symbol, selectedTimeframe]
  );

  useEffect(() => {
    if (INSTITUTIONAL_SIGNALS_ONLY) return;
    return onSignalPipeline((result) => {
      console.log('[Lux:UI] local signal pipeline received - scannerRunningRef=', scannerRunningRef.current, ' result.signal=', !!result.signal);
      if (!result.signal || !scannerRunningRef.current) {
        console.log('[Lux:UI] local signal pipeline blocked - scannerRunningRef=', scannerRunningRef.current, ' has signal=', !!result.signal);
        return;
      }
      const session = analysisSessionRef.current;
      queueMicrotask(() => {
        if (session !== analysisSessionRef.current) return;
        console.log('[Lux:UI] local signal pipeline received signal - commit handled by handleScanner STEP 19 to avoid double commit');
        // commitUiSignal is called in handleScanner STEP 19 to avoid double commit
        // This subscription only receives the signal for tracking purposes
      });
    });
  }, []);

  /** Stream institucional — PC e celular recebem o mesmo payload do backend. */
  useEffect(() => {
    console.log('[TRACE] institutional stream useEffect called - symbol=', selectedAsset.symbol, ' timeframe=', selectedTimeframe);
    if (!API_ENABLED) {
      console.log('[TRACE] institutional stream useEffect API NOT enabled, returning');
      return;
    }
    const sym = selectedAsset.symbol;
    const tf = selectedTimeframe;
    console.log('[TRACE] institutional stream useEffect subscribing - sym=', sym, ' tf=', tf);
    const cleanup = subscribeInstitutionalSignalStream(sym, tf, (payload) => {
      console.log('[Lux:UI] institutional stream payload received - scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current);
      if (!isValidInstitutionalPayload(payload, sym)) return;
      // REMOVED: Blocking check that prevented signals during scanner analysis
      // The institutional API should always be able to deliver signals regardless of scanner state
      console.log('[Lux:UI] institutional stream committing signal');
      commitUiSignal(payload.signal!, payload.confidence, payload.snapshotId);
    });
    console.log('[TRACE] institutional stream useEffect cleanup function registered');
    return () => {
      console.log('[TRACE] institutional stream useEffect cleanup called');
      cleanup();
    };
  }, [selectedAsset.symbol, selectedTimeframe, commitUiSignal]);

  const lastManualAnalyzeAtRef = useRef(0);
  const bootAnalyzeKeyRef = useRef('');

  const assetMarketClosed = useMemo(
    () => isAssetMarketClosed(selectedAsset.symbol),
    [selectedAsset.symbol]
  );

  const applyInstitutionalBlock = useCallback(
    (blockReason: string | undefined) => {
      const code = normalizeBlockReasonCode(blockReason);
      lastAutoBlockRef.current = code;
      setScanBlockCode(code);
      setScanError(null);
      setCurrentSignal(null);
      invalidateSignal();
      logBlockReasonUi(code);
    },
    []
  );

  useEffect(() => {
    setScanBlockCode(null);
    setScanError(null);
    lastAutoBlockRef.current = null;
    bootAnalyzeKeyRef.current = '';
    // Force reset all locks and debounce on asset/timeframe change
    console.log('[TRACE] asset/timeframe changed, forcing lock reset');
    scannerRunningRef.current = false;
    analyzeLockRef.current = false;
    setInstitutionalScannerRunning(false);
    resetAnalysisDebounce();
    // Force release global lock even if not running
    globalAnalysisLock.release('done');
  }, [selectedAsset.symbol, selectedTimeframe]);

  const handleScanner = useCallback(async () => {
    console.log('[TRACE] STEP 1: handleScanner called');
    const trigger =
      scanSourceRef.current === 'auto' ? ('auto' as const) : ('manual' as const);
    console.log('[TRACE] STEP 2: trigger=', trigger);
    const gate = canStartAnalysis(trigger);
    console.log('[TRACE] STEP 3: canStartAnalysis result - ok=', gate.ok, ' reason=', gate.reason);
    if (!gate.ok) {
      console.log('[Lux:UI] analyze blocked —', gate.reason);
      return;
    }
    console.log('[TRACE] STEP 4: checking locks - scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current, ' globalAnalysisLock=', globalAnalysisLock.isRunning());
    if (scannerRunningRef.current || analyzeLockRef.current || globalAnalysisLock.isRunning()) {
      console.log('[Lux:UI] analyze blocked — already in progress - scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current, ' globalAnalysisLock=', globalAnalysisLock.isRunning());
      return;
    }
    if (
      !safeLiftOverride &&
      !settings.continueAfterDailyGoal &&
      (isGoalReached || isStopReached)
    ) {
      console.log('[TRACE] STEP 5: blocked by goal/stop - isGoalReached=', isGoalReached, ' isStopReached=', isStopReached);
      setSafeLiftAlert(isGoalReached ? 'GOAL' : 'STOP');
      return;
    }
    if (!safeLiftOverride && isStopReached) {
      console.log('[TRACE] STEP 6: blocked by stop');
      setSafeLiftAlert('STOP');
      return;
    }
    console.log('[TRACE] STEP 7: incrementing session');
    const session = ++analysisSessionRef.current;
    if (isAssetMarketClosed(selectedAsset.symbol)) {
      console.log('[TRACE] STEP 8: market closed, applying block');
      applyInstitutionalBlock('MARKET_CLOSED');
      return;
    }

    console.log('[TRACE] STEP 9: skipping global lock acquisition (enqueueAnalysis handles it internally)');
    // REMOVED: globalAnalysisLock.tryAcquire here because enqueueAnalysis already acquires the lock
    // This was causing ANALYSIS_BUSY because the lock was acquired twice
    // if (!globalAnalysisLock.tryAcquire(trigger === 'auto' ? 'auto-scan' : 'manual-scan')) {
    //   console.log('[TRACE] STEP 10: global lock acquisition failed');
    //   return;
    // }

    console.log('[TRACE] STEP 11: marking analysis started');
    markAnalysisStarted(trigger);
    lastManualAnalyzeAtRef.current = Date.now();

    console.log('[TRACE] STEP 12: setting flags to true');
    scannerRunningRef.current = true;
    setInstitutionalScannerRunning(true);
    analyzeLockRef.current = true;
    setIsAnalyzing(true);
    setScanError(null);
    setScanBlockCode(null);
    setWinProbability(undefined);
    console.log('[Lux] analysis started ui', selectedAsset.symbol, '- scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current);

    const sessionId = analysisLifecycle.begin('scanner');
    console.log('[TRACE] STEP 13: sessionId=', sessionId);
    const analyzeTimeout = window.setTimeout(() => {
      if (analyzeLockRef.current) {
        console.log('[TRACE] TIMEOUT: analysis timed out, forcing finalize');
        analysisLifecycle.forceComplete('timeout');
        finalizeAnalysis();
        setScanError('Mercado recalibrando…');
      }
    }, ANALYSIS_TIMEOUT_MS);

    try {
      console.log('[TRACE] STEP 14: calling analyzeSignal');
      const result = await analyzeSignal({
        symbol: selectedAsset.symbol,
        asset: selectedAsset.symbol,
        timeframe: selectedTimeframe,
        balance: userBanca,
        riskPercent: riskLevel,
        livePrice: livePrice > 0 ? livePrice : undefined,
        timingMode: signalTimingMode,
        forceRest: marketLive,
        analyzeOrigin: scanSourceRef.current === 'auto' ? 'AUTO_SCAN' : 'USER_CLICK',
      });

      console.log('[TRACE] STEP 15: analyzeSignal returned - result.status=', result.status, ' result.blockReason=', result.blockReason);
      if (result.snapshotId) {
        markClientAnalyzedSnapshot(result.snapshotId);
      }

      const minAutoScore = settings.aiSensitivity ?? 90;
      const isAutoScan = scanSourceRef.current === 'auto';

      if (result.blockReason?.includes('ANALYSIS_BUSY')) {
        console.log('[TRACE] STEP 16: ANALYSIS_BUSY, returning');
        return result;
      }

      if (
        result.status === 'OK' &&
        isValidSignalResult(result, selectedAsset.symbol) &&
        session === analysisSessionRef.current
      ) {
        console.log('[TRACE] STEP 17: OK signal received - result.status=', result.status, ' isValidSignalResult=', isValidSignalResult(result, selectedAsset.symbol), ' session match=', session === analysisSessionRef.current);
        setScanBlockCode(null);
        lastAutoBlockRef.current = null;
        const sig = result.signal!;
        // Manual clicks should never be blocked by ID comparison
        const alreadyCommitted = trigger !== 'manual' && lastSignalRef.current?.id === sig.id;
        console.log('[TRACE] STEP 18: signal check - alreadyCommitted=', alreadyCommitted, ' trigger=', trigger, ' sig.id=', sig.id, ' lastSignalRef.current?.id=', lastSignalRef.current?.id);
        console.log(
          '[AUDIT-DUPLICATE]',
          {
            signalId: sig?.id,
            lastSignalId: lastSignalRef.current?.id,
            sameId: sig?.id === lastSignalRef.current?.id,
            sameReference: sig === lastSignalRef.current,
            trigger
          }
        );
        if (!alreadyCommitted) {
          console.log('[TRACE] STEP 19: committing signal');
          commitUiSignal(
            sig,
            result.winProbability ?? sig.winProbability,
            result.snapshotId
          );
        } else {
          console.log('[TRACE] STEP 20: signal already committed, calling finalizeAnalysis');
          finalizeAnalysis();
        }

        const notifyAllowed =
          !isAutoScan || (sig.confidence ?? sig.score) >= minAutoScore;

        if (notifyAllowed) {
          playSFX(SFX.SIGNAL);
        }

        if (execution.autoExecute && settings.autoTradeEnabled && notifyAllowed) {
          execution.executeSignal(sig, userBanca).then((r) => {
            if (r.success) setGlobalSuccess('ORDEM EXECUTADA — ' + r.message);
            else logger.warn(r.message, 'execution');
          });
        }
        const notifyThreshold = settings.aiSensitivity ?? 90;
        const shouldNotify =
          notifyAllowed &&
          settings.notificationsEnabled &&
          (sig.confidence ?? sig.score) >= notifyThreshold &&
          lastNotifiedSignalIdRef.current !== sig.id;

        if (shouldNotify) {
          lastNotifiedSignalIdRef.current = sig.id;
          requestNotificationPermission().then((granted) => {
            if (granted) {
              if (signalTimingMode === 'CONFIRMED') {
                notifyConfirmedSignal(sig, result.winProbability, true);
              } else {
                sendDeviceNotification(sig, result.winProbability, true, {
                  playSound: true,
                  soundEnabled: settings.soundEnabled,
                });
              }
            }
          });
        }

        if (notifyAllowed && isIdealSignal(sig, result.winProbability)) {
          setIdealPopupSignal(sig);
          setIdealWinProb(result.winProbability);
          if (settings.hapticFeedback) triggerHaptic(true);
        } else if (
          notifyAllowed &&
          settings.hapticFeedback &&
          (sig.confidence ?? sig.score) >= notifyThreshold + 8
        ) {
          triggerHaptic(true);
        }
      } else if (session === analysisSessionRef.current) {
        console.log('[TRACE] STEP 21: NO_DATA or BLOCKED - result.status=', result.status, ' result.blockReason=', result.blockReason, ' session match=', session === analysisSessionRef.current);
        const blockCode = normalizeBlockReasonCode(result.blockReason);
        if (
          blockCode === 'MARKET_CLOSED' ||
          blockCode === 'NO_PROVIDER' ||
          blockCode === 'NO_MARKET_DATA' ||
          blockCode === 'INSUFFICIENT_CANDLES' ||
          blockCode === 'PROVIDER_ERROR' ||
          blockCode === 'INVALID_SNAPSHOT' ||
          blockCode === 'NO_CONSENSUS'
        ) {
          console.log('[TRACE] STEP 22: applying institutional block - blockCode=', blockCode);
          applyInstitutionalBlock(result.blockReason);
          finalizeAnalysis();
        } else if (result.blockReason?.includes('offline') || result.blockReason?.includes('indisponível')) {
          console.log('[TRACE] STEP 23: offline error');
          setScanBlockCode(null);
          setScanError(result.blockReason);
          setCurrentSignal(null);
        } else {
          console.log('[TRACE] STEP 24: generic error - setting retry message');
          setScanBlockCode(null);
          setScanError('Reanalisando mercado — toque em Analisar novamente');
          setCurrentSignal(null);
        }
      }
    } catch (e) {
      console.log('[TRACE] STEP 25: catch block - error=', e instanceof Error ? e.message : String(e));
      const msg = e instanceof Error ? e.message : 'Erro na análise';
      setScanError(
        msg.includes('fetch') || msg.includes('Failed') || msg.includes('offline')
          ? 'API offline — execute: npm run dev'
          : msg
      );
    } finally {
      console.log('[TRACE] STEP 26: finally block - clearing timeout');
      window.clearTimeout(analyzeTimeout);
      // REMOVED: globalAnalysisLock.release('done') here because enqueueAnalysis handles lock release
      // The lock is now only acquired in enqueueAnalysis, not in handleScanner
      if (session === analysisSessionRef.current) {
        console.log('[TRACE] STEP 27: session match - lastSignalRef.current=', !!lastSignalRef.current, ' scannerRunningRef=', scannerRunningRef.current, ' analyzeLockRef=', analyzeLockRef.current);
        if (!lastSignalRef.current) {
          console.log('[TRACE] STEP 28: no signal generated, calling finalizeAnalysis');
          finalizeAnalysis();
        } else {
          console.log('[TRACE] STEP 29: signal already committed, skipping finalizeAnalysis');
        }
        analysisLifecycle.complete(sessionId, 'success');
        console.log('[TRACE] STEP 30: analysis finished ui');
      }
    }
  }, [
    commitUiSignal,
    finalizeAnalysis,
    selectedAsset,
    userBanca,
    riskLevel,
    isGoalReached,
    isStopReached,
    playSFX,
    livePrice,
    selectedTimeframe,
    signalTimingMode,
    settings.notificationsEnabled,
    settings.hapticFeedback,
    settings.autoTradeEnabled,
    execution,
    safeLiftOverride,
    settings.aiSensitivity,
    settings.tradingStyle,
    marketLive,
    applyInstitutionalBlock,
  ]);

  const handleScannerRef = useRef(handleScanner);
  useEffect(() => {
    handleScannerRef.current = handleScanner;
  }, [handleScanner]);

  const withinTradingHours = useMemo(() => {
    const h = new Date().getUTCHours();
    const start = settings.tradingHourStart ?? 0;
    const end = settings.tradingHourEnd ?? 23;
    if (start <= end) return h >= start && h <= end;
    return h >= start || h <= end;
  }, [settings.tradingHourStart, settings.tradingHourEnd]);

  useAutoAIScan({
    enabled:
      !!currentUser &&
      settings.autoAIScanEnabled === true &&
      currentView === 'dashboard' &&
      withinTradingHours &&
      !assetMarketClosed &&
      !shouldSkipAutoReanalysis(lastAutoBlockRef.current ?? ''),
    onScan: async () => {
      scanSourceRef.current = 'auto';
      try {
        await handleScannerRef.current();
      } finally {
        scanSourceRef.current = 'manual';
      }
    },
    isAnalyzing,
    intervalMs: settings.autoAIScanIntervalMs ?? 25000,
  });

  useEffect(() => {
    if (!shouldAutoRefreshFromCandles()) return;
    const unsub = candleStreamService.onSignalRefresh((reason) => {
      if (reason !== 'candle-close') return;
      if (!settings.autoAIScanEnabled || currentView !== 'dashboard') return;
      if (scannerRunningRef.current || analyzeLockRef.current || globalAnalysisLock.isRunning()) return;
      if (isAssetMarketClosed(selectedAsset.symbol)) return;
      if (shouldSkipAutoReanalysis(lastAutoBlockRef.current ?? '')) return;
      const gate = canStartAnalysis('refresh');
      if (!gate.ok) return;
      scanSourceRef.current = 'auto';
      void handleScannerRef.current();
    });
    return unsub;
  }, [settings.autoAIScanEnabled, currentView, selectedAsset.symbol]);

  useEffect(() => {
    if (!currentUser) return;
    if (settings.autoAIScanEnabled) return;
    if (isAssetMarketClosed(selectedAsset.symbol)) {
      applyInstitutionalBlock('MARKET_CLOSED');
      return;
    }
    const bootKey = `${selectedAsset.symbol}:${selectedTimeframe}`;
    if (bootAnalyzeKeyRef.current === bootKey) return;
    const boot = window.setTimeout(() => {
      if (bootAnalyzeKeyRef.current === bootKey) return;
      if (currentSignal || scannerRunningRef.current || analyzeLockRef.current) return;
      if (isAssetMarketClosed(selectedAsset.symbol)) return;
      const gate = canStartAnalysis('boot');
      if (!gate.ok) return;
      bootAnalyzeKeyRef.current = bootKey;
      scanSourceRef.current = 'manual';
      void handleScannerRef.current();
    }, 8000);
    return () => clearTimeout(boot);
  }, [selectedAsset.symbol, selectedTimeframe, currentUser, settings.autoAIScanEnabled, applyInstitutionalBlock]);

  const handleSaveOperation = (item: TradeHistoryItem) => {
    let wasUpdate = false;
    setHistory((prev) => {
      const idx = prev.findIndex((h) => h.id === item.id);
      if (idx >= 0) {
        wasUpdate = true;
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [item, ...prev];
    });
    setHistoryEditItem(null);
    setGlobalSuccess(wasUpdate ? 'OPERAÇÃO ATUALIZADA' : 'OPERAÇÃO SALVA');
    if (settings.notificationsEnabled) {
      requestNotificationPermission().then((ok) => {
        if (ok) notifyOperationSaved(item.asset, true);
      });
    }
    setTimeout(() => setGlobalSuccess(null), 3000);
  };

  const saveSignalToHistory = useCallback(
    (sig: TradeSignal) => {
      const tz =
        CHART_TIMEZONES.find((z) => z.value === settings.timezone)?.utc ?? 'UTC';
      const entryVal = sig.entry;
      const riskDist = Math.abs(sig.entry - sig.sl) || 1;
      const rewardDist = Math.abs(sig.tp1 - sig.entry);
      const roiEst = entryVal > 0 ? (rewardDist / riskDist) * 100 : 0;
      const now = new Date();
      handleSaveOperation({
        id: `OP-${Date.now()}`,
        userId: currentUser?.id,
        userName: currentUser?.name,
        asset: sig.asset,
        type: sig.type,
        result: 'PENDING',
        profit: 0,
        entryValue: entryVal,
        timeframe: selectedTimeframe,
        timestamp: now.toISOString(),
        confidence: sig.score,
        score: sig.score,
        entry: sig.entry,
        stop: sig.sl,
        take: sig.tp1,
        takeProfit: sig.tp1,
        stopLoss: sig.sl,
        tp2: sig.tp2,
        tp3: sig.tp3,
        invalidation: sig.invalidation,
        timingMode: sig.timingMode ?? signalTimingMode,
        confluences: sig.confluences ?? [],
        risks: sig.risks ?? [],
        aiExplanation: sig.aiExplanation ?? sig.fullRationale ?? sig.mainReason,
        session: sig.session,
        indicatorSnapshot: sig.indicatorCalculations,
        utcLabel: tz,
        notes: [
          sig.institutionalAnalysis?.summary ?? sig.mainReason,
          `Hora: ${now.toLocaleTimeString('pt-BR')}`,
          `Direção: ${sig.type}`,
        ].join(' · '),
        roi: Math.round(roiEst * 10) / 10,
        operationalStrength: sig.confidenceLabel ?? sig.strength,
        operationDurationMinutes: sig.estimatedMinutes,
        assertiveness: sig.winProbability ?? sig.score,
      });
    },
    [currentUser, selectedTimeframe, signalTimingMode, settings.timezone]
  );

  const handleShareToken = useCallback(async () => {
    if (!currentUser || sharingToken) return;
    setSharingToken(true);
    try {
      if (shareTokenRef.current) {
        await shareTokenImage(
          shareTokenRef.current,
          currentUser.name,
          currentUser.accessId
        );
        setGlobalSuccess('IMAGEM PREMIUM GERADA');
      } else if (navigator.share) {
        await navigator.share({
          title: 'Lux Trader FX',
          text: buildTokenShareText(currentUser.name, currentUser.accessId),
        });
        setGlobalSuccess('TOKEN COMPARTILHADO');
      } else {
        await navigator.clipboard.writeText(
          buildTokenShareText(currentUser.name, currentUser.accessId)
        );
        setGlobalSuccess('TEXTO COPIADO');
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setGlobalSuccess('NÃO FOI POSSÍVEL COMPARTILHAR');
      }
    } finally {
      setSharingToken(false);
      setTimeout(() => setGlobalSuccess(null), 3000);
    }
  }, [currentUser, sharingToken]);

  const handleLogin = () => {
    const token = accessIdInput.trim().toUpperCase();
    if (!token) {
      setLoginError("DIGITE SEU TOKEN DE ACESSO");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    setTimeout(() => {
      let clients: User[] = JSON.parse(localStorage.getItem('lux_admin_clients') || '[]');
      const foundUser = clients.find(c => c.accessId.toUpperCase() === token);
      const masterToken = (localStorage.getItem('lux_master_admin_token') || 'ADMIN-LUX-AM-001').toUpperCase();
      if (foundUser || token === masterToken) {
        const user = foundUser || {
          id: 'admin',
          name: 'Master Admin',
          accessId: token,
          role: 'admin',
          plan: 'Licenciado',
          status: 'active',
          createdAt: new Date().toISOString(),
          settings: settings,
        };
        setCurrentUser(user as User);
        localStorage.setItem('lux_active_user', JSON.stringify(user));
        markOnboardingComplete();
        ensureNotificationPermission();
        markSplashComplete();
      } else {
        setLoginError("TOKEN INVÁLIDO OU NÃO AUTORIZADO");
        playSFX(SFX.ALERT);
      }
      setIsLoggingIn(false);
    }, 1200);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const updatedUser = { ...currentUser, profilePic: base64 };
        setCurrentUser(updatedUser);
        localStorage.setItem('lux_active_user', JSON.stringify(updatedUser));
        setGlobalSuccess("FOTO ATUALIZADA");
        setTimeout(() => setGlobalSuccess(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredAssets = useMemo(() => {
    return ASSETS
      .filter(a => !disabledAssets.includes(a.symbol)) // Filtra desativados
      .filter(a => 
        a.symbol.toLowerCase().includes(assetSearch.toLowerCase()) || 
        a.name.toLowerCase().includes(assetSearch.toLowerCase())
      );
  }, [assetSearch, disabledAssets]);

  if (loading) {
    return (
      <PremiumSplash
        symbol={selectedAsset.symbol}
        timeframe={selectedTimeframe}
        onComplete={() => {
          markSplashComplete();
          setLoading(false);
        }}
      />
    );
  }
 
  if (!currentUser) return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-[#020204]">
      <FuturisticBg theme={theme} />
      <div className="w-full max-w-[360px] flex flex-col items-center relative z-10 animate-view-entry">
        <Logo className="w-32 h-32 mb-10" animate={true} showText={true} />
        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.35em] text-center mb-4 italic max-w-sm leading-relaxed">
          Bem-vindo ao Lux Trader FX PRO.
        </p>
        <p className="text-[10px] text-zinc-600 text-center mb-8 max-w-xs leading-relaxed px-2">
          Sua plataforma institucional de análise avançada está pronta para operar.
        </p>
        <div className="w-full glass-morphism p-12 rounded-[4rem] space-y-10 border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.9)] relative overflow-hidden">
          <div className="space-y-4">
            <div className="relative group">
              <input 
                type="text" 
                value={accessIdInput} 
                onChange={e => { setAccessIdInput(e.target.value); setLoginError(null); }} 
                placeholder="TOKEN DE ACESSO" 
                className={`w-full border p-6 rounded-[2rem] font-black text-center tracking-[0.3em] uppercase outline-none bg-black/60 text-white transition-all shadow-inner ${loginError ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 'border-white/5 focus:border-blue-500/50 group-hover:border-white/10'}`}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
              />
              <Lock className={`absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${loginError ? 'text-red-500' : 'text-zinc-800'}`} />
            </div>
            {loginError && (
              <div className="text-red-500 text-[10px] font-black uppercase italic tracking-[0.3em] text-center animate-bounce-short">
                {loginError}
              </div>
            )}
          </div>
          <button 
            onClick={handleLogin} 
            disabled={isLoggingIn} 
            className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.4em] flex items-center justify-center gap-4 shadow-2xl transition-all disabled:opacity-50 italic ${loginError ? 'bg-red-600/20 text-red-500 border border-red-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 border-b-6 border-blue-800'}`}
          >
            {isLoggingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
            {isLoggingIn ? 'SINCRONIZANDO...' : 'ENTRAR NO TERMINAL'}
          </button>
        </div>
        <p className="mt-10 text-[9px] font-black uppercase tracking-[0.8em] text-zinc-800 italic opacity-50">Deep Space Layer v9.0.2</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden text-white relative">
      <FuturisticBg theme={theme} />
      {safeLiftAlert && (
        <SafeLiftAlert
          type={safeLiftAlert}
          onClose={() => setSafeLiftAlert(null)}
          onContinueTrading={continueAfterSafeLift}
          t={t}
        />
      )}
      
      <header className="glass-morphism px-4 sm:px-6 py-3 flex items-center justify-between z-[100] shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <Logo className="w-9 h-9 shrink-0" />
          <h1 className="text-xs sm:text-sm font-black italic tracking-tight uppercase text-glow truncate">
            LUX TRADER FX
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {currentView !== 'dashboard' && (
            <div className="text-right hidden sm:block">
              <div className="font-black mono text-sm text-white">${userBanca.toLocaleString()}</div>
            </div>
          )}
          <div className="w-10 h-10 rounded-xl border border-blue-500/20 overflow-hidden bg-zinc-900">
            {currentUser.profilePic ? (
              <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-blue-500">
                <Logo className="w-5 h-5" />
              </div>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('lux_active_user');
              setCurrentUser(null);
            }}
            className="p-2 text-zinc-600 hover:text-red-500"
            aria-label="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-48 custom-scrollbar relative z-10">
        {currentView === 'dashboard' && (
          <PremiumTerminal
            asset={selectedAsset}
            timeframe={selectedTimeframe}
            theme={theme}
            timezone={settings.timezone}
            onTimezoneChange={(tz) => setSettings((s) => ({ ...s, timezone: tz }))}
            livePrice={livePrice}
            wsStatus={displayWsStatus}
            dataProvider={dataProvider}
            userBanca={userBanca}
            todayPnl={todayProfit}
            timingMode={signalTimingMode}
            onTimingModeChange={setSignalTimingMode}
            onAssetClick={() => setActivePicker('asset')}
            onTimeframeClick={() => setActivePicker('tf')}
            onAnalyze={handleScanner}
            isAnalyzing={isAnalyzing}
            scanError={scanError}
            scanBlockCode={scanBlockCode}
            signal={currentSignal}
            analyzeLabel={t.analyzeBtn}
            favoriteAssets={favoriteAssets}
            favoriteTimeframes={favoriteTimeframes}
            onToggleFavoriteAsset={(sym) =>
              setFavoriteAssets(toggleFavoriteAsset(sym))
            }
            onToggleFavoriteTimeframe={(tf) =>
              setFavoriteTimeframes(toggleFavoriteTimeframe(tf))
            }
            onSelectFavoriteAsset={(sym) => {
              const found = ASSETS.find((a) => a.symbol === sym);
              if (found) setSelectedAsset(found);
            }}
            onSelectFavoriteTimeframe={setSelectedTimeframe}
            onSaveSignal={
              currentSignal
                ? () => {
                    setHistoryEditItem(null);
                    setSaveModalOpen(true);
                  }
                : undefined
            }
            autoAIEnabled={settings.autoAIScanEnabled === true}
            onToggleAutoAI={() => {
              const next = !settings.autoAIScanEnabled;
              setSettings((s) => ({ ...s, autoAIScanEnabled: next }));
              setGlobalSuccess(next ? 'IA AUTOMÁTICA ATIVADA' : 'IA AUTOMÁTICA PAUSADA');
              setTimeout(() => setGlobalSuccess(null), 2500);
            }}
          />
        )}

        {currentView === 'history' && (
          <HistoryPanel
            history={history}
            onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))}
            onUpdateResult={(id, result, profit) =>
              setHistory((h) =>
                h.map((item) =>
                  item.id === id
                    ? { ...item, result, profit, profitUsd: profit }
                    : item
                )
              )
            }
            onEdit={(item) => {
              setHistoryEditItem(item);
              setSaveModalOpen(true);
            }}
          />
        )}

        {currentView === 'manual' && <ManualView />}

        {currentView === 'settings' && (
          <div className="p-8 md:p-14 space-y-8 max-w-xl mx-auto pb-48 animate-view-entry">
            <div className="glass-morphism p-10 rounded-[4rem] space-y-10 border border-white/5 shadow-2xl mb-6 bg-[#050508]/60 relative overflow-hidden group">
              <div className="flex flex-col items-center gap-8 relative z-10">
                <div className="relative">
                  <div className="w-36 h-36 rounded-[3rem] border-4 border-blue-600/30 overflow-hidden bg-zinc-900 shadow-[0_0_80px_rgba(59,130,246,0.3)] flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
                    {currentUser.profilePic ? (
                      <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="Perfil" />
                    ) : (
                      <Logo className="w-20 h-20" />
                    )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-[-15px] right-[-15px] w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.5)] border-4 border-[#050508] hover:bg-blue-500 transition-all active:scale-90 z-20">
                    <Camera className="w-6 h-6" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleProfilePicChange} accept="image/*" className="hidden" />
                </div>
                <div className="text-center">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white text-glow">{currentUser.name}</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-3 italic">
                    Licença premium ativa
                  </p>
                </div>
              </div>
              <div className="p-6 rounded-[2rem] border border-blue-500/20 bg-blue-500/5 space-y-4">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center">
                  Token de acesso
                </p>
                <p className="text-center font-black mono text-lg text-blue-400 tracking-wider break-all">
                  {currentUser.accessId}
                </p>
                <button
                  type="button"
                  onClick={handleShareToken}
                  disabled={sharingToken}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.35em] flex items-center justify-center gap-3 border-b-4 border-blue-800 italic active:scale-95 transition-all"
                >
                  {sharingToken ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                  Compartilhar token
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentUser.accessId);
                    setGlobalSuccess('TOKEN COPIADO');
                    setTimeout(() => setGlobalSuccess(null), 2000);
                  }}
                  className="w-full py-3 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copiar token
                </button>
              </div>
              <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[80px] rounded-full pointer-events-none"></div>
            </div>
            <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0" aria-hidden>
              <ShareTokenImageCard
                ref={shareTokenRef}
                userName={currentUser.name}
                token={currentUser.accessId}
              />
            </div>

            <div className="glass-morphism p-8 rounded-[2.5rem] border border-white/5 shadow-xl bg-[#050508]/60 space-y-5">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-zinc-900 rounded-2xl text-zinc-500 shadow-inner"><Wallet className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-[13px] font-black uppercase italic tracking-widest text-white leading-none">{t.balance}</h3>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">CAPITAL OPERACIONAL</p>
                </div>
              </div>
              <input 
                type="number" 
                value={userBanca} 
                onChange={e => setUserBanca(Number(e.target.value))} 
                className="w-full bg-black/60 border border-white/5 p-6 rounded-2xl text-center font-black italic mono text-2xl text-blue-500 outline-none focus:border-blue-500/50 shadow-inner"
              />
            </div>

            <div onClick={() => setActivePicker('language')} className="glass-morphism p-8 rounded-[2.5rem] flex items-center justify-between border border-white/5 shadow-xl bg-[#050508]/60 cursor-pointer hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-zinc-900 rounded-2xl text-zinc-500 group-hover:text-blue-500 transition-colors shadow-inner"><LanguageIcon className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-[13px] font-black uppercase italic tracking-widest text-white leading-none">{t.language}</h3>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2 group-hover:text-zinc-400">{LANGUAGES.find(l => l.code === settings.language)?.name}</p>
                </div>
              </div>
              <ChevronDown className="w-6 h-6 text-zinc-800 group-hover:text-blue-500" />
            </div>

            {[
              { id: 'theme', icon: theme === 'dark' ? Moon : SunMedium, title: t.interfaceVisual, sub: theme === 'dark' ? t.deepSpace : t.solarLight, active: theme === 'dark', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
              { id: 'sound', icon: Volume2, title: t.soundLabel, sub: t.soundDesc, active: settings.soundEnabled, onClick: () => setSettings({...settings, soundEnabled: !settings.soundEnabled}) },
              { id: 'alerts', icon: Bell, title: t.notifLabel, sub: t.notifDesc, active: settings.notificationsEnabled, onClick: () => setSettings({...settings, notificationsEnabled: !settings.notificationsEnabled}) }
            ].map((item) => (
              <div key={item.id} className="glass-morphism p-8 rounded-[2.5rem] flex items-center justify-between border border-white/5 shadow-xl bg-[#050508]/60 group">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-zinc-900 rounded-2xl text-zinc-500 group-hover:text-blue-500 transition-colors shadow-inner"><item.icon className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-[13px] font-black uppercase italic tracking-widest text-white leading-none">{item.title}</h3>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">{item.sub}</p>
                  </div>
                </div>
                <div onClick={item.onClick} className={`w-16 h-8 rounded-full relative cursor-pointer transition-all ${item.active ? 'bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-zinc-900'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${item.active ? 'left-9 shadow-lg' : 'left-1 shadow-md'}`}></div>
                </div>
              </div>
            ))}

            <div onClick={() => setActivePicker('currency')} className="glass-morphism p-8 rounded-[2.5rem] flex items-center justify-between border border-white/5 shadow-xl bg-[#050508]/60 cursor-pointer hover:bg-white/5 transition-all group">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-zinc-900 rounded-2xl text-zinc-500 group-hover:text-blue-500 transition-colors shadow-inner"><Coins className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-[13px] font-black uppercase italic tracking-widest text-white leading-none">{t.currency}</h3>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">{CURRENCIES.find(c => c.code === settings.displayCurrency)?.name || 'DÓLAR AMERICANO (USD)'}</p>
                </div>
              </div>
              <ChevronDown className="w-6 h-6 text-zinc-800 group-hover:text-blue-500" />
            </div>

            <div className="pt-10 space-y-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 shadow-inner border border-blue-500/10">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none text-white text-glow">{t.safeLiftTitle}</h3>
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-3 italic">{t.safeLiftSubtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-8 pt-4">
                {[
                  { label: t.dailyGoal, val: settings.dailyGoalValue, type: settings.dailyGoalType, onVal: (v: number) => setSettings({...settings, dailyGoalValue: v}), onType: (t: any) => setSettings({...settings, dailyGoalType: t}), color: 'bg-blue-600' },
                  { label: t.dailyStop, val: settings.dailyStopLoss, type: settings.dailyStopLossType, onVal: (v: number) => setSettings({...settings, dailyStopLoss: v}), onType: (t: any) => setSettings({...settings, dailyStopLossType: t}), color: 'bg-red-600' }
                ].map((input, idx) => (
                  <div key={idx} className="glass-morphism p-8 rounded-[3rem] space-y-6 border border-white/5 bg-[#050508]/60 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase italic tracking-widest text-zinc-600">{input.label}</h4>
                      <div className="flex bg-zinc-950 rounded-2xl p-1.5 border border-white/5 shadow-inner">
                        <button onClick={() => input.onType('fixed')} className={`px-5 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all ${input.type === 'fixed' ? `${input.color} text-white shadow-lg` : 'text-zinc-700'}`}>{t.typeFixed}</button>
                        <button onClick={() => input.onType('percent')} className={`px-5 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all ${input.type === 'percent' ? `${input.color} text-white shadow-lg` : 'text-zinc-700'}`}>{t.typePercent}</button>
                      </div>
                    </div>
                    <input type="number" value={input.val} onChange={e => input.onVal(Number(e.target.value))} className="w-full bg-black/70 border border-white/5 p-6 rounded-2xl text-center font-black italic mono text-2xl text-white outline-none focus:border-blue-500/50 shadow-inner" />
                  </div>
                ))}
              </div>
            </div>
            
            <AdvancedSettingsPanel
              settings={settings}
              onChange={setSettings}
              riskLevel={riskLevel}
              onRiskChange={setRiskLevel}
            />

            <button onClick={() => { localStorage.setItem('lux_settings', JSON.stringify(settings)); setGlobalSuccess("DADOS SINCRONIZADOS"); setTimeout(() => setGlobalSuccess(null), 3000); }} className="w-full py-8 bg-blue-600 text-white rounded-[3rem] font-black uppercase text-[14px] tracking-[0.5em] flex items-center justify-center gap-5 shadow-[0_30px_70px_rgba(59,130,246,0.3)] border-b-8 border-blue-800 italic active:scale-95 transition-all mt-6 text-glow">
              <Save className="w-6 h-6" /> {t.saveProtocol}
            </button>
          </div>
        )}

        {currentView === 'admin' && <AdminPanel />}
      </main>

      <nav className="glass-morphism fixed bottom-0 left-0 right-0 z-[100] flex justify-around items-center px-8 pt-6 pb-12 border-t border-white/5 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        {[
          { id: 'dashboard', label: t.terminal, icon: LayoutDashboard },
          { id: 'history', label: t.history, icon: History },
          { id: 'manual', label: t.manual, icon: BookOpen },
          { id: 'settings', label: t.config, icon: Settings },
          { id: 'admin', label: t.admin, icon: Shield, adminOnly: true },
        ].map((item) => (
          (item.adminOnly && currentUser?.role !== 'admin') ? null : (
            <button key={item.id} onClick={() => changeView(item.id)} className={`flex flex-col items-center gap-3 transition-all ${currentView === item.id ? 'text-blue-500 scale-115' : 'text-zinc-800 hover:text-zinc-500'}`}>
              <item.icon className={`w-7 h-7 ${currentView === item.id ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]' : ''}`} />
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] italic ${currentView === item.id ? 'opacity-100 text-glow' : 'opacity-40'}`}>{item.label}</span>
            </button>
          )
        ))}
      </nav>

      {/* MODAL GLOBAL HUB ATUALIZADO */}
      {isHubOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
           <div className="w-full max-w-xl glass-morphism rounded-[4rem] p-12 border border-white/10 space-y-10 shadow-[0_60px_140px_rgba(0,0,0,1)] relative animate-in zoom-in-95 duration-500">
              <div className="flex justify-between items-center border-b border-white/5 pb-8">
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-inner">
                    <Globe className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white text-glow">Global Hub</h3>
                </div>
                <button onClick={() => setIsHubOpen(false)} className="p-3 bg-white/5 rounded-full text-zinc-700 hover:text-white transition-all shadow-sm">
                  <X className="w-7 h-7" />
                </button>
              </div>
              <div className="space-y-5 max-h-[55vh] overflow-y-auto custom-scrollbar pr-3">
                {MARKET_SESSIONS.map(session => {
                  const open = isSessionOpen(session);
                  const isSelected = settings.timezone === session.timezone;
                  return (
                    <div 
                      key={session.id} 
                      onClick={() => handleSelectSession(session)}
                      className={`p-7 rounded-[2.5rem] border transition-all flex items-center justify-between group cursor-pointer shadow-md ${isSelected ? 'border-blue-500/50 bg-blue-600/10' : 'border-white/5 bg-[#050508]/80 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-6">
                        <span className="text-3xl group-hover:scale-125 transition-transform duration-500">{session.icon}</span>
                        <div>
                          <h4 className={`text-[16px] font-black uppercase italic leading-none ${isSelected ? 'text-blue-400 text-glow' : 'text-white'}`}>{session.city}</h4>
                          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-3">SINCRONIA: {session.openUTC}H - {session.closeUTC}H UTC</p>
                        </div>
                      </div>
                      <div className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${open ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'bg-zinc-950 text-zinc-800 border-white/5'}`}>
                        {open ? 'ATIVO' : 'FECHADO'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-blue-600/5 p-8 rounded-[3rem] border border-blue-500/10 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-5">
                  <Clock className="w-7 h-7 text-blue-500" />
                  <span className="text-[12px] font-black mono text-zinc-600 tracking-widest">HORÁRIO UTC ATUAL</span>
                </div>
                <span className="text-2xl font-black italic mono text-blue-500 text-glow">{currentTimeUTC.toString().padStart(2, '0')}:{currentMinuteUTC.toString().padStart(2, '0')}</span>
              </div>
              <p className="text-[10px] font-bold text-center text-zinc-700 uppercase tracking-widest italic opacity-50">CLIQUE EM UMA SESSÃO PARA SINCRONIZAR O TERMINAL</p>
           </div>
        </div>
      )}

      {activePicker && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700" onClick={() => setActivePicker(null)}></div>
          <div className="relative w-full max-w-2xl glass-morphism rounded-t-[5rem] p-12 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-1000 shadow-[0_-40px_100px_rgba(0,0,0,0.8)]">
             <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
               <h3 className="text-2xl font-black uppercase italic text-white tracking-tighter text-glow">Seletor de Parâmetros</h3>
               <button onClick={() => setActivePicker(null)} className="p-3 bg-white/5 rounded-full text-zinc-800 hover:text-white transition-all shadow-sm"><X className="w-7 h-7" /></button>
             </div>
             
             {activePicker === 'asset' && (
               <div className="relative mb-8 group">
                 <input type="text" value={assetSearch} onChange={e => setAssetSearch(e.target.value)} placeholder="PESQUISAR INSTRUMENTO..." className="w-full bg-black/60 border border-white/5 p-6 pl-16 rounded-[2rem] font-black italic text-[16px] text-white uppercase outline-none focus:border-blue-500/50 shadow-inner group-hover:border-white/10 transition-all" />
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-800 group-hover:text-blue-500 transition-colors" />
               </div>
             )}

             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-3 pb-12">
                {activePicker === 'asset' ? filteredAssets.map(asset => (
                  <div key={asset.symbol} onClick={() => { setSelectedAsset(asset); setActivePicker(null); setAssetSearch(''); }} className="p-6 rounded-[2.5rem] border border-white/5 bg-white/5 hover:bg-blue-600 transition-all cursor-pointer font-black italic flex justify-between items-center group shadow-md">
                    <div>
                      <span className="text-white text-xl group-hover:text-white transition-colors">{asset.symbol}</span>
                      <p className="text-[10px] text-zinc-600 uppercase mt-2 tracking-widest group-hover:text-blue-200 transition-colors">{asset.name}</p>
                    </div>
                    <span className="text-[10px] bg-black/50 px-5 py-2 rounded-xl text-zinc-600 group-hover:bg-blue-800 group-hover:text-white transition-all shadow-inner">{asset.category}</span>
                  </div>
                )) : activePicker === 'tf' ? TIMEFRAMES.map(tf => (
                  <div key={tf.value} onClick={() => { setSelectedTimeframe(tf.value); setActivePicker(null); }} className="p-8 rounded-[2.5rem] border border-white/5 bg-white/5 hover:bg-blue-600 transition-all cursor-pointer font-black italic text-white text-lg shadow-md">{tf.label}</div>
                )) : activePicker === 'currency' ? CURRENCIES.map(curr => (
                  <div key={curr.code} onClick={() => { setSettings({...settings, displayCurrency: curr.code}); setActivePicker(null); }} className={`p-8 rounded-[2.5rem] border border-white/5 transition-all cursor-pointer font-black italic flex justify-between items-center shadow-md ${settings.displayCurrency === curr.code ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-zinc-600 hover:bg-white/10'}`}>
                    <span className="text-lg">{curr.name}</span>
                    {settings.displayCurrency === curr.code && <CheckCircle2 className="w-7 h-7" />}
                  </div>
                )) : activePicker === 'language' ? LANGUAGES.map(lang => (
                  <div key={lang.code} onClick={() => { setSettings({...settings, language: lang.code as SupportedLanguage}); setActivePicker(null); }} className={`p-8 rounded-[2.5rem] border border-white/5 transition-all cursor-pointer font-black italic flex justify-between items-center shadow-md ${settings.language === lang.code ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-zinc-600 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-6">
                      <span className="text-3xl">{lang.icon}</span>
                      <span className="text-lg">{lang.name}</span>
                    </div>
                    {settings.language === lang.code && <CheckCircle2 className="w-7 h-7" />}
                  </div>
                )) : null}
                {activePicker === 'asset' && filteredAssets.length === 0 && (
                   <div className="py-24 text-center opacity-10 flex flex-col items-center gap-6"><Search className="w-20 h-20" /><p className="font-black uppercase tracking-[0.8em]">Nada Encontrado</p></div>
                )}
             </div>
          </div>
        </div>
      )}

      {globalSuccess && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[3000] bg-blue-600 text-white px-10 py-5 rounded-full shadow-[0_30px_70px_rgba(59,130,246,0.5)] font-black text-[11px] uppercase tracking-[0.3em] flex items-center gap-5 animate-in fade-in slide-in-from-top-6 italic">
           <CircleCheck className="w-6 h-6" /> {globalSuccess}
        </div>
      )}

      <SaveOperationModal
        isOpen={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setHistoryEditItem(null);
        }}
        onSave={handleSaveOperation}
        editItem={historyEditItem}
        defaultAsset={historyEditItem?.asset ?? currentSignal?.asset ?? selectedAsset.symbol}
        defaultType={historyEditItem?.type ?? currentSignal?.type}
        defaultTimeframe={historyEditItem?.timeframe ?? selectedTimeframe}
        defaultConfidence={historyEditItem?.confidence ?? winProbability ?? currentSignal?.score}
        defaultScore={historyEditItem?.score ?? currentSignal?.score}
        defaultEntry={historyEditItem?.entry ?? currentSignal?.entry}
        defaultStop={historyEditItem?.stopLoss ?? currentSignal?.sl}
        defaultTake={historyEditItem?.takeProfit ?? currentSignal?.tp1}
        defaultTp2={historyEditItem?.tp2 ?? currentSignal?.tp2}
        defaultTp3={historyEditItem?.tp3 ?? currentSignal?.tp3}
        defaultInvalidation={historyEditItem?.invalidation ?? currentSignal?.invalidation}
        defaultTimingMode={historyEditItem?.timingMode ?? currentSignal?.timingMode ?? signalTimingMode}
        defaultConfluences={historyEditItem?.confluences ?? currentSignal?.confluences ?? []}
        defaultWinProbability={
          historyEditItem?.winProbability ?? winProbability ?? currentSignal?.winProbability
        }
        defaultMarketCondition={
          historyEditItem?.marketCondition ?? currentSignal?.marketCondition
        }
        userId={currentUser?.id}
        userName={currentUser?.name}
      />

      <SignalIdealPopup
        signal={idealPopupSignal}
        winProbability={idealWinProb}
        onClose={() => setIdealPopupSignal(null)}
        onConfirm={() => changeView('dashboard')}
      />

      <PWAInstallPrompt />
    </div>
  );
};

export default App;
