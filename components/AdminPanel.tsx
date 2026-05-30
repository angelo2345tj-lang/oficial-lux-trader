
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole } from '../types';
import { ASSETS } from '../constants';
import { 
  Users, UserPlus, Search, Shield, 
  X, Check, Settings, Trash2, Edit3, CircleCheck, 
  Cpu, Lock, LayoutDashboard, KeyRound, Save,
  Loader2, Phone, BarChart3, Activity, Globe,
  Server, Zap, AlertTriangle, RefreshCw, Signal,
  Box, HardDrive, Download, Upload,
  Database, Eye, EyeOff, ShieldCheck as ShieldCheckIcon
} from 'lucide-react';

const AdminPanel: React.FC = () => {
  // Estado das abas com persistência simples para manter o admin na mesma tela após refresh
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'config' | 'assets'>(() => {
    return (localStorage.getItem('lux_admin_active_tab') as any) || 'overview';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [clients, setClients] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('lux_admin_clients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // Estado para gerenciar ativos desativados
  const [disabledAssets, setDisabledAssets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lux_disabled_assets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [systemVersion] = useState("v9.0.2-ELITE");
  const [systemMaintenance, setSystemMaintenance] = useState(false);
  const [signalIntensity, setSignalIntensity] = useState(88);
  
  const [masterTokenInput, setMasterTokenInput] = useState(() => {
    try {
      return (localStorage.getItem('lux_master_admin_token') || 'ADMIN-LUX-AM-001').toUpperCase();
    } catch (e) { return 'ADMIN-LUX-AM-001'; }
  });
  const [isSavingToken, setIsSavingToken] = useState(false);

  const [formData, setFormData] = useState<Partial<User>>({
    name: '', phone: '', accessId: '', status: 'active', role: 'user'
  });

  // Salva a aba ativa para persistência
  useEffect(() => {
    localStorage.setItem('lux_admin_active_tab', activeTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleUpdateMasterToken = () => {
    setIsSavingToken(true);
    setTimeout(() => {
      const token = masterTokenInput.trim().toUpperCase();
      localStorage.setItem('lux_master_admin_token', token);
      setSuccessMessage("CHAVE MESTRA SINCRONIZADA");
      setIsSavingToken(false);
    }, 800);
  };

  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name,
        phone: editingClient.phone || '',
        accessId: editingClient.accessId.toUpperCase(),
        status: editingClient.status,
        role: editingClient.role
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        accessId: `LUX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'active',
        role: 'user'
      });
    }
  }, [editingClient, isModalOpen]);

  // Salva clientes no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lux_admin_clients', JSON.stringify(clients));
    } catch (e) {
      console.error("Erro ao salvar clientes:", e);
    }
  }, [clients]);

  // Salva ativos desativados no localStorage
  useEffect(() => {
    localStorage.setItem('lux_disabled_assets', JSON.stringify(disabledAssets));
  }, [disabledAssets]);

  const toggleAsset = (symbol: string) => {
    setDisabledAssets(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol) 
        : [...prev, symbol]
    );
    setSuccessMessage(`STATUS DO ATIVO ${symbol} ALTERADO`);
  };

  const handleSaveUser = () => {
    if (!formData.name || !formData.accessId) return;
    const tokenToSave = formData.accessId!.trim().toUpperCase();

    let newClientsList: User[];

    if (editingClient) {
      newClientsList = clients.map(c => c.id === editingClient.id ? { ...c, ...formData, accessId: tokenToSave } as User : c);
      setSuccessMessage(formData.role === 'admin' ? "ADMINISTRADOR ATUALIZADO" : "TERMINAL ATUALIZADO");
    } else {
      const newUser: User = {
        id: Date.now().toString(),
        name: formData.name!,
        phone: formData.phone || '',
        accessId: tokenToSave,
        plan: 'Licenciado',
        role: (formData.role as UserRole) || 'user',
        status: (formData.status as any) || 'active',
        createdAt: new Date().toISOString(),
        settings: {
          notificationsEnabled: true, soundEnabled: true, hapticFeedback: true, riskPercent: 2,
          fixedLotSize: 0.1, dailyGoalValue: 200, dailyGoalType: 'fixed', dailyStopLoss: 100,
          dailyStopLossType: 'fixed', language: 'pt_BR', timezone: 'America/Sao_Paulo', userBanca: 10000,
          autoAnalyzeOnAssetChange: false, showEconomicNews: true, marketSessionAlerts: true,
          defaultLotMultiplier: 1.0, autoTradeEnabled: false, displayCurrency: 'USD'
        }
      };
      newClientsList = [newUser, ...clients];
      setSuccessMessage(formData.role === 'admin' ? "NOVO ADMINISTRADOR ATIVADO" : "NOVO ACESSO ATIVADO");
    }

    setClients(newClientsList);
    setIsModalOpen(false);
  };

  const handleExportDB = () => {
    const data = JSON.stringify({
      clients,
      disabledAssets,
      masterToken: localStorage.getItem('lux_master_admin_token'),
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lux_trader_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setSuccessMessage("BASE EXPORTADA");
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.clients && Array.isArray(json.clients)) {
          setClients(json.clients);
          if (json.disabledAssets) setDisabledAssets(json.disabledAssets);
          if (json.masterToken) {
            localStorage.setItem('lux_master_admin_token', json.masterToken);
            setMasterTokenInput(json.masterToken);
          }
          setSuccessMessage("BASE RESTAURADA");
        }
      } catch (err) {
        alert("Falha ao importar base de dados.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = ''; 
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const stats = useMemo(() => ({
    totalUsers: clients.length,
    activeUsers: clients.filter(c => c.status === 'active').length,
    licensedUsers: clients.filter(c => c.status === 'active').length,
    systemLoad: 12,
    networkLatency: 4
  }), [clients]);

  return (
    <div className="p-8 md:p-12 space-y-12 max-w-7xl mx-auto pb-48 animate-view-entry" ref={scrollContainerRef}>
      {successMessage && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[3000] bg-blue-600 text-white px-8 py-4 rounded-full shadow-[0_20px_50px_rgba(59,130,246,0.3)] font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 italic">
           <CircleCheck className="w-5 h-5" /> {successMessage}
        </div>
      )}

      {/* CABEÇALHO ADMIN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
        <div className="flex items-center gap-5">
           <div className="p-4 bg-blue-600/10 rounded-[1.5rem] border border-blue-500/20 shadow-lg">
              <Shield className="w-10 h-10 text-blue-500" />
           </div>
           <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none" style={{ color: 'var(--text-main)' }}>Núcleo de Comando</h2>
              <p className="text-[9px] font-black uppercase tracking-[0.5em] mt-3 text-zinc-500">Firmware: {systemVersion}</p>
           </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS INTERNA */}
        <div className="flex p-1.5 rounded-[1.8rem] backdrop-blur-3xl border shadow-2xl overflow-x-auto no-scrollbar w-full md:w-auto" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)' }}>
           {[
             { id: 'overview', label: 'DASHBOARD', icon: LayoutDashboard },
             { id: 'users', label: 'OPERADORES', icon: Users },
             { id: 'assets', label: 'INSTRUMENTOS', icon: Box },
             { id: 'config', label: 'SISTEMA', icon: Settings }
           ].map(tab => (
             <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 active:scale-95 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)]' : 'text-zinc-600 hover:text-zinc-300'}`}
             >
               <tab.icon className="w-4 h-4" />
               <span>{tab.label}</span>
             </button>
           ))}
        </div>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="relative min-h-[400px]">
        
        {/* ABA: OVERVIEW */}
        {activeTab === 'overview' && (
          <div key="tab-overview" className="space-y-8 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Terminais Ativos', value: stats.activeUsers, icon: Users, color: 'text-blue-500' },
                  { label: 'Carga de Processamento', value: `${stats.systemLoad}%`, icon: Cpu, color: 'text-amber-500' },
                  { label: 'Latência de Nodes', value: `${stats.networkLatency}ms`, icon: Activity, color: 'text-green-500' },
                  { label: 'Status da Lux-Net', value: 'ESTÁVEL', icon: Globe, color: 'text-cyan-500' }
                ].map((m, i) => (
                  <div key={i} className="glass-morphism p-8 rounded-[3rem] border border-white/5 space-y-4 relative overflow-hidden group shadow-xl">
                     <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <m.icon className="w-20 h-20" />
                     </div>
                     <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl bg-white/5 ${m.color}`}>
                           <m.icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{m.label}</span>
                     </div>
                     <p className="text-4xl font-black italic tracking-tighter mono" style={{ color: 'var(--text-main)' }}>{m.value}</p>
                  </div>
                ))}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-morphism p-10 rounded-[3rem] space-y-8 shadow-2xl">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <BarChart3 className="w-6 h-6 text-blue-500" />
                         <h3 className="text-[14px] font-black uppercase tracking-[0.2em] italic" style={{ color: 'var(--text-main)' }}>Fluxo de Ordens Globais</h3>
                      </div>
                      <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-3 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> TEMPO REAL</span>
                   </div>
                   <div className="h-[240px] w-full bg-black/40 rounded-[2.5rem] border border-white/5 flex items-end justify-around p-10 gap-3 shadow-inner">
                      {[35, 55, 40, 85, 70, 80, 100, 75, 65, 90, 85, 70].map((h, i) => (
                        <div key={i} className="w-full bg-blue-600/20 rounded-xl transition-all hover:bg-blue-500 relative group border-t border-white/10" style={{ height: `${h}%` }}>
                           <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl">{h}%</div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="glass-morphism p-10 rounded-[3rem] space-y-8 shadow-2xl">
                   <div className="flex items-center gap-4">
                      <Server className="w-6 h-6 text-blue-500" />
                      <h3 className="text-[14px] font-black uppercase tracking-[0.2em] italic" style={{ color: 'var(--text-main)' }}>Lux Nodes Telemetry</h3>
                   </div>
                   <div className="space-y-4">
                      {[
                        { name: 'NY_EQUINIX_NODE_1', status: 'Online', ping: '1.2ms' },
                        { name: 'LD_EQUINIX_NODE_2', status: 'Online', ping: '2.5ms' },
                        { name: 'TK_CRYSTAL_NODE_3', status: 'Online', ping: '8.1ms' },
                        { name: 'SP_AURORA_NODE_4', status: 'Ready', ping: '--' }
                      ].map((node, i) => (
                        <div key={i} className="p-5 rounded-[2rem] border border-white/5 flex justify-between items-center transition-all hover:bg-white/5 group shadow-sm" style={{ backgroundColor: 'var(--bg-input)' }}>
                           <div>
                              <p className="text-[11px] font-black italic tracking-tighter text-white">{node.name}</p>
                              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1 group-hover:text-blue-500">{node.status}</p>
                           </div>
                           <span className="text-[10px] font-black mono text-blue-500 bg-blue-500/5 px-3 py-1 rounded-lg">{node.ping}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* ABA: USERS */}
        {activeTab === 'users' && (
          <div key="tab-users" className="space-y-8 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row gap-6">
                <div className="relative flex-1">
                   <input 
                     type="text" placeholder="BUSCAR TOKEN OU OPERADOR..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                     style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                     className="w-full border p-6 pl-16 rounded-[2rem] font-black italic text-[14px] outline-none focus:border-blue-500/40 transition-all uppercase shadow-2xl"
                   />
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-800" />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => { setEditingClient(null); setFormData({...formData, role: 'admin'}); setIsModalOpen(true); }} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 shadow-lg transition-all border-b-4 border-amber-800 active:scale-95 italic shrink-0">
                     <ShieldCheckIcon className="w-5 h-5" /> NOVO ADMIN
                  </button>
                  <button onClick={() => { setEditingClient(null); setFormData({...formData, role: 'user'}); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 shadow-lg transition-all border-b-4 border-blue-800 active:scale-95 italic shrink-0">
                     <UserPlus className="w-5 h-5" /> NOVO USER
                  </button>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.accessId.includes(searchTerm.toUpperCase())).map(client => (
                  <div key={client.id} className="glass-morphism p-8 rounded-[3rem] border border-white/5 flex flex-col gap-8 group hover:border-blue-500/40 transition-all shadow-2xl relative overflow-hidden">
                     <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-5">
                           <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center font-black text-2xl italic border shadow-inner ${client.role === 'admin' ? 'bg-amber-600/10 text-amber-500 border-amber-500/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                              {client.name.charAt(0)}
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black italic uppercase tracking-tighter text-lg" style={{ color: 'var(--text-main)' }}>{client.name}</h4>
                                {client.role === 'admin' && <Shield className="w-3 h-3 text-amber-500" />}
                              </div>
                              <span className={`text-[9px] font-black px-3 py-1 rounded-xl mono tracking-widest border ${client.role === 'admin' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}>{client.accessId}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="p-3 bg-white/5 text-zinc-700 hover:text-blue-500 rounded-2xl transition-all shadow-sm"><Edit3 className="w-5 h-5" /></button>
                           <button onClick={() => { if(confirm("DESEJA REVOGAR O ACESSO DESTE TERMINAL?")) setClients(clients.filter(c => c.id !== client.id)) }} className="p-3 bg-red-500/5 text-zinc-700 hover:text-red-500 rounded-2xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                        </div>
                     </div>
                     <div className="flex items-center justify-between border-t border-white/5 pt-6 relative z-10">
                        <div className="flex gap-3">
                           <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl tracking-[0.2em] italic ${client.role === 'admin' ? 'bg-amber-900/40 text-amber-500' : 'bg-zinc-900 text-zinc-500'}`}>{client.role}</span>
                           <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl tracking-[0.2em] italic border ${client.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>{client.status === 'active' ? 'SINC' : 'BLOQ'}</span>
                        </div>
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest italic">{new Date(client.createdAt).toLocaleDateString()}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* ABA: ASSETS (INSTRUMENTOS) - COM OPÇÃO DE DESATIVAR */}
        {activeTab === 'assets' && (
          <div key="tab-assets" className="space-y-8 animate-in fade-in duration-500">
             <div className="glass-morphism p-10 rounded-[3rem] space-y-10 shadow-2xl border border-white/5">
                <div className="flex items-center gap-4">
                   <Box className="w-7 h-7 text-blue-500" />
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: 'var(--text-main)' }}>Instrumentos Ativos no Terminal</h3>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2 italic">Gerencie a visibilidade dos ativos para os operadores finais</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {ASSETS.map((asset) => {
                     const isDisabled = disabledAssets.includes(asset.symbol);
                     return (
                      <div 
                        key={asset.symbol} 
                        onClick={() => toggleAsset(asset.symbol)}
                        className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-4 group relative overflow-hidden cursor-pointer shadow-md ${isDisabled ? 'bg-zinc-900/50 border-red-500/10 opacity-60' : 'bg-white/5 border-white/5 hover:bg-blue-600/10 hover:border-blue-500/30'}`}
                      >
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm border transition-all group-hover:scale-110 ${isDisabled ? 'bg-zinc-800 text-zinc-600 border-zinc-700' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                            {asset.symbol.substring(0,2)}
                         </div>
                         <div className="text-center">
                            <p className={`text-[12px] font-black italic leading-none ${isDisabled ? 'text-zinc-600' : 'text-white'}`}>{asset.symbol}</p>
                            <p className={`text-[7px] font-bold uppercase tracking-widest mt-2 ${isDisabled ? 'text-red-500' : 'text-zinc-600'}`}>
                                {isDisabled ? 'DESATIVADO' : 'ATIVADO'}
                            </p>
                         </div>
                         {isDisabled ? (
                           <EyeOff className="w-3 h-3 text-red-500 absolute top-3 right-3" />
                         ) : (
                           <Eye className="w-3 h-3 text-green-500 absolute top-3 right-3" />
                         )}
                      </div>
                     );
                   })}
                </div>
             </div>
          </div>
        )}

        {/* ABA: CONFIG (SISTEMA) */}
        {activeTab === 'config' && (
          <div key="tab-config" className="space-y-10 animate-in fade-in duration-500">
             {/* BACKUP E RESTAURAÇÃO */}
             <div className="glass-morphism p-10 rounded-[3rem] space-y-10 border border-white/5 shadow-2xl">
                <div className="flex items-center gap-4">
                   <Database className="w-7 h-7 text-blue-500" />
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: 'var(--text-main)' }}>Base de Dados</h3>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2 italic">Sincronize terminais entre diferentes dispositivos</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button onClick={handleExportDB} className="p-8 bg-blue-600/10 hover:bg-blue-600/20 rounded-[2.5rem] border border-blue-500/20 transition-all flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.3em] italic text-blue-500 group active:scale-95 shadow-lg">
                     <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" /> Exportar Backup (JSON)
                  </button>
                  <div className="relative">
                    <input type="file" ref={fileInputRef} onChange={handleImportDB} accept=".json" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full p-8 bg-amber-500/10 hover:bg-amber-500/20 rounded-[2.5rem] border border-amber-500/20 transition-all flex items-center justify-center gap-4 font-black text-[11px] uppercase tracking-[0.3em] italic text-amber-500 group active:scale-95 shadow-lg">
                       <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" /> Importar Backup
                    </button>
                  </div>
                </div>
             </div>

             <div className="glass-morphism p-10 rounded-[3rem] space-y-10 border border-white/5 shadow-2xl">
                <div className="flex items-center gap-4">
                   <KeyRound className="w-7 h-7 text-blue-500" />
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: 'var(--text-main)' }}>Criptografia Master</h3>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2 italic">Protocolo de autenticação administrativa de alto nível</p>
                   </div>
                </div>

                <div className="bg-black/50 p-10 rounded-[3rem] border border-white/5 space-y-6 shadow-inner">
                   <div className="space-y-4">
                      <label className="text-[11px] font-black text-zinc-600 uppercase ml-4 tracking-[0.3em] italic">Chave de Acesso Admin</label>
                      <div className="flex flex-col md:flex-row gap-6">
                         <div className="relative flex-1">
                            <input 
                              type="text" value={masterTokenInput} onChange={e => setMasterTokenInput(e.target.value.toUpperCase())}
                              placeholder="NOVA CHAVE MESTRA..." 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                              className="w-full border p-6 pl-16 rounded-[2rem] font-black italic text-[16px] outline-none focus:border-blue-500/40 transition-all uppercase mono shadow-xl"
                            />
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 text-zinc-900" />
                         </div>
                         <button onClick={handleUpdateMasterToken} disabled={isSavingToken} className="bg-blue-600 hover:bg-blue-500 text-white px-12 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.3em] flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(59,130,246,0.3)] transition-all active:scale-95 border-b-4 border-blue-800 py-6 md:py-0 italic">
                            {isSavingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-6 h-6" />}
                            SALVAR CHAVE
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

      </div>

      {/* MODAL DE USUÁRIO / ADMIN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="w-full max-w-lg glass-morphism rounded-[4rem] p-12 border border-white/10 space-y-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative overflow-y-auto max-h-[95vh] custom-scrollbar">
              <div className="flex justify-between items-center border-b border-white/5 pb-8">
                 <h3 className={`text-2xl font-black italic uppercase tracking-tighter ${formData.role === 'admin' ? 'text-amber-500' : 'text-white'}`}>
                   {editingClient 
                      ? (formData.role === 'admin' ? 'Sincronizar Admin' : 'Sincronizar Operador') 
                      : (formData.role === 'admin' ? 'Nova Ativação Admin' : 'Nova Ativação Lux')}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/5 rounded-full text-zinc-700 hover:text-red-500 transition-all shadow-sm"><X className="w-7 h-7" /></button>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase ml-5 italic tracking-widest text-zinc-600">Identificação do Nome</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Administrador Senior" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} className="w-full border p-5 rounded-2xl font-black italic text-[14px] outline-none focus:border-blue-500/40 uppercase shadow-inner" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase ml-5 italic tracking-widest text-zinc-600">Token de Acesso Lux</label>
                    <div className="relative">
                       <input type="text" value={formData.accessId} onChange={e => setFormData({...formData, accessId: e.target.value.toUpperCase()})} style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: formData.role === 'admin' ? 'var(--amber-500)' : 'var(--accent)' }} className="w-full border p-5 rounded-2xl font-black italic text-[14px] outline-none mono uppercase shadow-inner" />
                       <Zap className={`absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 ${formData.role === 'admin' ? 'text-amber-500/40' : 'text-blue-600/40'}`} />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase ml-5 italic tracking-widest text-zinc-600">Hierarquia</label>
                       <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} className="w-full border p-5 rounded-2xl font-black italic text-[12px] outline-none uppercase appearance-none shadow-inner">
                          <option value="user">USER (OPERADOR)</option>
                          <option value="admin">ADMIN (CONTROLADOR)</option>
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase ml-5 italic tracking-widest text-zinc-600">Situação</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }} className="w-full border p-5 rounded-2xl font-black italic text-[12px] outline-none uppercase appearance-none shadow-inner">
                       <option value="active">ATIVO / SINCRONIZADO</option>
                       <option value="blocked">BLOQUEADO / DESLIGADO</option>
                    </select>
                 </div>

                 <button onClick={handleSaveUser} className={`w-full py-6 rounded-[2rem] font-black uppercase text-[13px] tracking-[0.4em] flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95 border-b-6 mt-6 italic text-glow ${formData.role === 'admin' ? 'bg-amber-600 hover:bg-amber-500 border-amber-800' : 'bg-blue-600 hover:bg-blue-500 border-blue-800'} text-white`}>
                    <Check className="w-7 h-7" /> {editingClient ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR ATIVAÇÃO'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
