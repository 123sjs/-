import * as React from "react";
import { useBotStore, type BotConfig } from "@/store/use-bot-store";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { AppDialog } from "./ui/app-dialog";
import { SiBinance, SiEthereum, SiSolana } from "react-icons/si";
import { Settings, Zap, Search, Layers, Play, Square, Activity, ChevronDown, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n/useLang";

type ChainOption = {
  id: string;
  label: string;
  shortLabel: string;
  chainId: number;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  color: string;
  rpcs: Array<{ label: string; url: string; latencyMs: number }>;
};

const CHAINS: ChainOption[] = [
  {
    id: 'BSC', label: 'BSC Mainnet', shortLabel: 'BSC', chainId: 56,
    icon: SiBinance, color: '#F3BA2F',
    rpcs: [
      { label: 'Binance Official', url: 'https://bsc-dataseed1.binance.org', latencyMs: 547 },
      { label: 'Nodereal', url: 'https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3', latencyMs: 312 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/bsc', latencyMs: 283 },
      { label: 'QuickNode', url: 'https://bsc.publicnode.com', latencyMs: 198 },
    ]
  },
  {
    id: 'SOL', label: 'Solana Mainnet', shortLabel: 'SOL', chainId: 1399811149,
    icon: SiSolana, color: '#9945FF',
    rpcs: [
      { label: 'Mainnet Beta', url: 'https://api.mainnet-beta.solana.com', latencyMs: 321 },
      { label: 'Helius', url: 'https://rpc.helius.xyz/?api-key=demo', latencyMs: 178 },
      { label: 'QuickNode', url: 'https://solana-mainnet.g.alchemy.com/v2/demo', latencyMs: 204 },
    ]
  },
  {
    id: 'ETH', label: 'Ethereum Mainnet', shortLabel: 'ETH', chainId: 1,
    icon: SiEthereum, color: '#627EEA',
    rpcs: [
      { label: 'Cloudflare', url: 'https://cloudflare-eth.com', latencyMs: 211 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/eth', latencyMs: 189 },
      { label: 'PublicNode', url: 'https://ethereum.publicnode.com', latencyMs: 156 },
    ]
  },
  {
    id: 'ARB', label: 'Arbitrum One', shortLabel: 'ARB', chainId: 42161,
    icon: SiEthereum, color: '#12AAFF',
    rpcs: [
      { label: 'Arbitrum Official', url: 'https://arb1.arbitrum.io/rpc', latencyMs: 175 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/arbitrum', latencyMs: 148 },
    ]
  },
  {
    id: 'BASE', label: 'Base Mainnet', shortLabel: 'BASE', chainId: 8453,
    icon: SiEthereum, color: '#0052FF',
    rpcs: [
      { label: 'Base Official', url: 'https://mainnet.base.org', latencyMs: 193 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/base', latencyMs: 164 },
    ]
  },
  {
    id: 'SONIC', label: 'Sonic Mainnet', shortLabel: 'SONIC', chainId: 146,
    icon: SiEthereum, color: '#00CFFF',
    rpcs: [
      { label: 'Sonic RPC', url: 'https://rpc.soniclabs.com', latencyMs: 189 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/sonic_mainnet', latencyMs: 214 },
    ]
  },
  {
    id: 'INK', label: 'Ink Mainnet', shortLabel: 'INK', chainId: 57073,
    icon: SiEthereum, color: '#B3A8FF',
    rpcs: [
      { label: 'Ink RPC', url: 'https://rpc-gel.inkonchain.com', latencyMs: 201 },
      { label: 'PublicNode', url: 'https://ink.publicnode.com', latencyMs: 225 },
    ]
  },
  {
    id: 'OP', label: 'Optimism', shortLabel: 'OP', chainId: 10,
    icon: SiEthereum, color: '#FF0420',
    rpcs: [
      { label: 'Optimism Official', url: 'https://mainnet.optimism.io', latencyMs: 203 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/optimism', latencyMs: 177 },
    ]
  },
  {
    id: 'AVAX', label: 'Avalanche C-Chain', shortLabel: 'AVAX', chainId: 43114,
    icon: SiEthereum, color: '#E84142',
    rpcs: [
      { label: 'Avalanche Official', url: 'https://api.avax.network/ext/bc/C/rpc', latencyMs: 267 },
      { label: 'Ankr', url: 'https://rpc.ankr.com/avalanche', latencyMs: 241 },
    ]
  },
];

const MOCK_TOKENS = [
  { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', color: '#26A17B', badge: '₮' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', color: '#2775CA', badge: '$' },
  { symbol: 'BUSD', name: 'Binance USD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', color: '#F0B90B', badge: 'B' },
  { symbol: 'CAKE', name: 'PancakeSwap', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', color: '#1FC7D4', badge: '🥞' },
  { symbol: 'WBNB', name: 'Wrapped BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', color: '#F3BA2F', badge: 'W' },
  { symbol: 'BTCB', name: 'Bitcoin BEP20', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', color: '#F7931A', badge: '₿' },
];

export function ConfigPanel() {
  const { config, updateConfig, startBot, stopBot, isRunning, stats, runsCompleted } = useBotStore();
  const { t } = useLang();
  const c = t.config;

  const DEX_OPTIONS = [
    { id: 'Auto(V3&V2)', label: '⚡️ Auto(V3&V2)' },
    { id: 'MetaMask Swap', label: '🦊 MetaMask Swap' },
    { id: 'Flap', label: 'Flap' },
    { id: 'pancakeV2', label: '🥞 PancakeV2' },
    { id: 'pancakePump', label: 'PumpSpringBoard' },
    { id: 'FOUR.MEME', label: 'FOUR.MEME' },
  ];

  const AMOUNT_MODES: Array<{ id: BotConfig['amountMode']; label: string }> = [
    { id: 'All', label: c.allAmount },
    { id: 'Random', label: c.randomAmount },
    { id: 'Percent', label: c.percentAmount },
    { id: 'Fixed', label: c.fixedAmount },
    { id: 'Fixed Retention', label: c.fixedRetention },
  ];

  const GAS_MODES: Array<BotConfig['gasPriceMode']> = ['Fixed', 'Auto', 'Random'];

  // Token search state
  const [tokenSearch, setTokenSearch] = React.useState(MOCK_TOKENS[0].address);
  const [tokenResults, setTokenResults] = React.useState<typeof MOCK_TOKENS>([]);
  const [selectedToken, setSelectedToken] = React.useState(MOCK_TOKENS[0]);
  const [tokenDropdownOpen, setTokenDropdownOpen] = React.useState(false);
  const tokenRef = React.useRef<HTMLDivElement>(null);

  // Chain selector state
  const [chainDropdownOpen, setChainDropdownOpen] = React.useState(false);
  const selectedChain = CHAINS.find(ch => ch.id === config.chain) ?? CHAINS[0];
  const chainRef = React.useRef<HTMLDivElement>(null);

  // RPC selector state
  const [rpcModalOpen, setRpcModalOpen] = React.useState(false);
  const currentRpc = selectedChain.rpcs.find(r => r.url === config.rpc) ?? selectedChain.rpcs[0];

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tokenRef.current && !tokenRef.current.contains(e.target as Node)) {
        setTokenDropdownOpen(false);
      }
      if (chainRef.current && !chainRef.current.contains(e.target as Node)) {
        setChainDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTokenSearch = (value: string) => {
    setTokenSearch(value);
    if (value.length >= 2) {
      const q = value.toLowerCase();
      const results = MOCK_TOKENS.filter(tok => 
        tok.symbol.toLowerCase().includes(q) || 
        tok.name.toLowerCase().includes(q) || 
        tok.address.toLowerCase().includes(q)
      );
      setTokenResults(results);
      setTokenDropdownOpen(results.length > 0);
    } else {
      setTokenResults([]);
      setTokenDropdownOpen(false);
    }
  };

  const selectToken = (token: typeof MOCK_TOKENS[0]) => {
    setSelectedToken(token);
    setTokenSearch(token.address);
    setTokenDropdownOpen(false);
  };

  const selectChain = (chain: ChainOption) => {
    updateConfig({ chain: chain.id, rpc: chain.rpcs[0].url });
    setChainDropdownOpen(false);
  };

  const selectRpc = (rpc: ChainOption['rpcs'][0]) => {
    updateConfig({ rpc: rpc.url });
    setRpcModalOpen(false);
  };

  const ChainIcon = selectedChain.icon;

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-lg overflow-y-auto scrollbar-custom p-6 space-y-8 relative">
      
      {/* Overlay when running */}
      {isRunning && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
          <div className="bg-card p-8 rounded-2xl border border-primary/30 shadow-[0_0_50px_rgba(0,208,133,0.15)] flex flex-col items-center max-w-sm text-center">
            <div className="w-16 h-16 relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{c.botRunning}</h3>
            <p className="text-muted-foreground text-sm mb-6">{c.botRunningDesc}</p>
            <div className="w-full bg-black/30 rounded-lg p-4 mb-6 font-mono text-sm border border-white/5">
              {c.runs}: <span className="text-white">{runsCompleted}</span> / {config.repeatTimes}
            </div>
            <Button variant="danger" size="lg" className="w-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)]" onClick={stopBot}>
              <Square className="w-5 h-5 mr-2 fill-current" /> {c.stopBot}
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 1: Token & Chain */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> {c.tokenConfig}
          </h3>
          <div className="flex items-center gap-2 text-xs bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <span className="text-muted-foreground">{c.fixedBNB}</span>
            <Switch />
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
          <div ref={tokenRef} className="relative">
            <div className="flex gap-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border" style={{ backgroundColor: `${selectedToken.color}15`, borderColor: `${selectedToken.color}30`, color: selectedToken.color }}>
                <span className="text-lg font-bold">{selectedToken.badge}</span>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  placeholder={c.searchToken}
                  value={tokenSearch}
                  onChange={e => handleTokenSearch(e.target.value)}
                  onFocus={() => { if (tokenResults.length > 0) setTokenDropdownOpen(true); }}
                />
              </div>
            </div>

            {tokenDropdownOpen && tokenResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                {tokenResults.map(token => (
                  <button
                    key={token.address}
                    onClick={() => selectToken(token)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: `${token.color}20`, color: token.color }}>
                      {token.badge}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{token.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground">{c.selected}</span>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-mono font-medium border" style={{ backgroundColor: `${selectedToken.color}10`, borderColor: `${selectedToken.color}20`, color: selectedToken.color }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-black text-[10px] font-bold" style={{ backgroundColor: selectedToken.color }}>
                  {selectedToken.badge}
                </div>
                {selectedToken.symbol} {selectedToken.address.slice(0, 5)}...{selectedToken.address.slice(-4)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{c.chain} (Id: {selectedChain.chainId})</label>
            <div ref={chainRef} className="relative">
              <button
                onClick={() => setChainDropdownOpen(v => !v)}
                className="w-full h-10 bg-black/20 border border-white/10 rounded-xl px-3 flex items-center gap-2 text-sm text-white hover:border-white/30 transition-colors"
              >
                <ChainIcon className="shrink-0" style={{ color: selectedChain.color }} />
                <span className="flex-1 text-left truncate">{selectedChain.shortLabel} {c.mainnet}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", chainDropdownOpen && "rotate-180")} />
              </button>
              {chainDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                  {CHAINS.map(chain => {
                    const Icon = chain.icon;
                    return (
                      <button
                        key={chain.id}
                        onClick={() => selectChain(chain)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left",
                          config.chain === chain.id && "bg-primary/10"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" style={{ color: chain.color }} />
                        <span className="text-sm text-white">{chain.label}</span>
                        {config.chain === chain.id && <span className="ml-auto text-primary text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between">
              {c.rpc}
              <span className="font-mono" style={{ color: currentRpc.latencyMs < 300 ? '#4ade80' : currentRpc.latencyMs < 500 ? '#facc15' : '#f87171' }}>
                {currentRpc.latencyMs} MS
              </span>
            </label>
            <button
              onClick={() => setRpcModalOpen(true)}
              className="w-full h-10 bg-black/20 border border-white/10 rounded-xl px-3 flex items-center justify-between text-sm text-white hover:border-white/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate font-mono text-xs">{config.rpc.replace('https://', '')}</span>
              </div>
              <Settings className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
            </button>
          </div>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* SECTION 2: Bot Settings */}
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> {c.executionSettings}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between">
              {c.sendDelay}
              <div className="flex items-center gap-1">
                <Checkbox checked={config.randomDelay} onChange={(e) => updateConfig({randomDelay: e.target.checked})} />
                <span className="text-[10px]">{c.random}</span>
              </div>
            </label>
            <Input type="number" value={config.delay} onChange={e => updateConfig({delay: Number(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{c.threads}</label>
            <Input type="number" value={config.threads} onChange={e => updateConfig({threads: Number(e.target.value)})} />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-muted-foreground">{c.dex}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEX_OPTIONS.map(dex => (
              <div 
                key={dex.id}
                onClick={() => updateConfig({ dex: dex.id })}
                className={cn(
                  "p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-sm",
                  config.dex === dex.id 
                    ? "border-primary bg-primary/10 text-white shadow-[0_0_10px_rgba(0,208,133,0.1)]" 
                    : "border-white/5 bg-black/20 text-muted-foreground hover:bg-white/5 hover:border-white/10"
                )}
              >
                <span className="font-medium truncate">{dex.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
          <label className="text-xs text-muted-foreground block mb-2">{c.swapAmount}</label>
          <div className="flex flex-wrap gap-2">
            {AMOUNT_MODES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => updateConfig({ amountMode: id })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs transition-colors",
                  config.amountMode === id ? "bg-primary text-black font-medium" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input 
            type="number" 
            step="0.01" 
            value={config.amountBNB} 
            onChange={e => updateConfig({ amountBNB: Number(e.target.value) })}
            className="text-lg h-12"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 bg-black/20 border border-white/5 p-4 rounded-xl">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{c.walletOrder}</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              <button 
                onClick={() => updateConfig({ executionOrder: 'Sequential' })}
                className={cn("flex-1 text-xs py-1.5 rounded-md transition-colors", config.executionOrder === 'Sequential' ? "bg-white/10 text-white" : "text-muted-foreground")}
              >{c.sequential}</button>
              <button 
                onClick={() => updateConfig({ executionOrder: 'Random' })}
                className={cn("flex-1 text-xs py-1.5 rounded-md transition-colors", config.executionOrder === 'Random' ? "bg-white/10 text-white" : "text-muted-foreground")}
              >{c.random}</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between items-center">
              {c.repeatRun}
              <Switch checked={config.repeatRun} onChange={e => updateConfig({ repeatRun: e.target.checked })} />
            </label>
            <Input 
              type="number" 
              value={config.repeatTimes} 
              onChange={e => updateConfig({ repeatTimes: Number(e.target.value) })}
              disabled={!config.repeatRun}
            />
          </div>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* SECTION 3: Gas */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 justify-between">
          <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#F3BA2F]" /> {c.gasSetting}</span>
          <span className="text-xs font-normal text-muted-foreground bg-black/20 px-2 py-1 rounded-full border border-white/5 font-mono">Current: 0.10 gwei</span>
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground block">{c.gasPrice}</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              {GAS_MODES.map(m => (
                <button 
                  key={m}
                  onClick={() => updateConfig({ gasPriceMode: m })}
                  className={cn("flex-1 text-[10px] py-1.5 rounded-md transition-colors", config.gasPriceMode === m ? "bg-white/10 text-white" : "text-muted-foreground")}
                >{m}</button>
              ))}
            </div>
            <Input type="number" step="0.01" value={config.gasPrice} onChange={e => updateConfig({gasPrice: Number(e.target.value)})} />
            
            <label className="text-xs text-muted-foreground flex justify-between items-center pt-2">
              {c.eip1559} <Switch checked={config.eip1559} onChange={e => updateConfig({eip1559: e.target.checked})} />
            </label>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-muted-foreground block">{c.gasLimit}</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              {GAS_MODES.map(m => (
                <button 
                  key={m}
                  onClick={() => updateConfig({ gasLimitMode: m })}
                  className={cn("flex-1 text-[10px] py-1.5 rounded-md transition-colors", config.gasLimitMode === m ? "bg-white/10 text-white" : "text-muted-foreground")}
                >{m}</button>
              ))}
            </div>
            <Input type="number" value={config.gasLimit} onChange={e => updateConfig({gasLimit: Number(e.target.value)})} />
          </div>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* SECTION 4: Stats & Control */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{c.estimateFee}</div>
            <div className="font-mono text-white">0.004 BNB</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{c.estimateVolume}</div>
            <div className="font-mono text-emerald-400 font-bold">{stats.volume.toFixed(4)} BNB <span className="text-muted-foreground font-normal text-xs">≈ ${(stats.volume * 608).toFixed(2)}</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{c.increasedTxns}</div>
            <div className="font-mono text-white text-xs">Buy {stats.buyTx} + Sell {stats.sellTx} = <span className="font-bold text-sm">{stats.buyTx + stats.sellTx}</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{c.bnbPrice}</div>
            <div className="font-mono text-white">$608</div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500/80 p-3 rounded-lg text-xs leading-relaxed">
        {c.taxTokenNote} <span className="font-mono text-amber-400 select-all">0xeB85C4e28aF444ce60Df31B6c670034c7f167c0a</span>
      </div>

      <Button 
        variant="premium" 
        size="lg" 
        className="w-full text-lg h-14 font-bold tracking-wide"
        onClick={startBot}
      >
        <Play className="w-5 h-5 mr-2 fill-black" /> {c.runBot}
      </Button>

      {/* RPC Selection Modal */}
      <AppDialog open={rpcModalOpen} onOpenChange={setRpcModalOpen} title={c.rpcModalTitle}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">{c.rpcModalDesc} <span className="text-white font-medium">{selectedChain.label}</span>. {c.lowerLatency}</p>
          {selectedChain.rpcs.map((rpc, i) => (
            <button
              key={i}
              onClick={() => selectRpc(rpc)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left",
                config.rpc === rpc.url
                  ? "border-primary bg-primary/10"
                  : "border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10"
              )}
            >
              <Wifi className={cn("w-5 h-5 shrink-0", rpc.latencyMs < 300 ? "text-emerald-400" : rpc.latencyMs < 500 ? "text-yellow-400" : "text-rose-400")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{rpc.label}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{rpc.url}</div>
              </div>
              <div className={cn("text-xs font-mono shrink-0 px-2 py-1 rounded", rpc.latencyMs < 300 ? "text-emerald-400 bg-emerald-400/10" : rpc.latencyMs < 500 ? "text-yellow-400 bg-yellow-400/10" : "text-rose-400 bg-rose-400/10")}>
                {rpc.latencyMs}ms
              </div>
              {config.rpc === rpc.url && <span className="text-primary text-sm">✓</span>}
            </button>
          ))}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Custom RPC URL:</p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://your-rpc-endpoint.com"
                className="flex-1 h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white font-mono focus:outline-none focus:border-primary transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val.startsWith('https://')) {
                      updateConfig({ rpc: val });
                      setRpcModalOpen(false);
                    }
                  }
                }}
              />
              <Button size="sm" variant="outline">Add</Button>
            </div>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
