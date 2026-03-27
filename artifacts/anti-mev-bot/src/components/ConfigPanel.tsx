import * as React from "react";
import { useBotStore, type BotConfig } from "@/store/use-bot-store";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Switch } from "./ui/Switch";
import { SiBinance, SiEthereum, SiSolana } from "react-icons/si";
import { Settings, Zap, Repeat, Search, Layers, Play, Square, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const DEX_OPTIONS = [
  { id: 'Auto(V3&V2)', label: '⚡️ Auto(V3&V2)' },
  { id: 'MetaMask Swap', label: 'MetaMask Swap', img: '🦊' },
  { id: 'Flap', label: 'Flap' },
  { id: 'pancakeV2', label: 'PancakeV2', icon: SiBinance },
  { id: 'pancakePump', label: 'PumpSpringBoard' },
  { id: 'FOUR.MEME', label: 'FOUR.MEME' },
];

export function ConfigPanel() {
  const { config, updateConfig, startBot, stopBot, isRunning, stats, runsCompleted } = useBotStore();

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
            <h3 className="text-xl font-bold text-white mb-2">Bot is Running</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Executing volume swaps across MEV-protected routes. Please do not close this window.
            </p>
            <div className="w-full bg-black/30 rounded-lg p-4 mb-6 font-mono text-sm border border-white/5">
              Runs: <span className="text-white">{runsCompleted}</span> / {config.repeatTimes}
            </div>
            <Button variant="danger" size="lg" className="w-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)]" onClick={stopBot}>
              <Square className="w-5 h-5 mr-2 fill-current" /> STOP BOT
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 1: Token & Chain */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Token Configuration
          </h3>
          <div className="flex items-center gap-2 text-xs bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <span className="text-muted-foreground">Fixed BNB</span>
            <Switch />
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
          <div className="flex gap-2">
            <div className="w-12 h-12 bg-[#F3BA2F]/10 text-[#F3BA2F] rounded-xl flex items-center justify-center shrink-0 border border-[#F3BA2F]/20">
              <SiBinance size={24} />
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary transition-all"
                placeholder="Search by token or paste address..."
                defaultValue="0x55d398326f99059fF775485246999027B3197955"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Selected:</span>
            <div className="flex items-center gap-2 bg-[#26A17B]/10 border border-[#26A17B]/20 text-[#26A17B] px-3 py-1 rounded-lg text-xs font-mono font-medium">
              <div className="w-4 h-4 rounded-full bg-[#26A17B] flex items-center justify-center text-black text-[10px]">₮</div>
              USDT 0x55d...7955
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Chain (Id: 56)</label>
            <div className="h-10 bg-black/20 border border-white/10 rounded-xl px-3 flex items-center gap-2 text-sm text-white cursor-not-allowed opacity-80">
              <SiBinance className="text-[#F3BA2F]" /> BSC Mainnet
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between">
              RPC <span className="text-emerald-400 font-mono">547 MS</span>
            </label>
            <div className="h-10 bg-black/20 border border-white/10 rounded-xl px-3 flex items-center justify-between text-sm text-white">
              <span className="truncate pr-2 font-mono text-xs">{config.rpc}</span>
              <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-white shrink-0" />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* SECTION 2: Bot Settings */}
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Execution Settings
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between">
              Send Delay(S) 
              <div className="flex items-center gap-1">
                <Checkbox checked={config.randomDelay} onChange={(e) => updateConfig({randomDelay: e.target.checked})} />
                <span className="text-[10px]">Random</span>
              </div>
            </label>
            <Input type="number" value={config.delay} onChange={e => updateConfig({delay: Number(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Threads</label>
            <Input type="number" value={config.threads} onChange={e => updateConfig({threads: Number(e.target.value)})} />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-muted-foreground">DEX (MEV-protected)</label>
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
                {dex.img && <span>{dex.img}</span>}
                {dex.icon && <dex.icon className="text-[#F3BA2F]" />}
                <span className="font-medium truncate">{dex.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
          <label className="text-xs text-muted-foreground block mb-2">Swap Amount (BNB)</label>
          <div className="flex flex-wrap gap-2">
            {['All Amount', 'Random Amount', 'Percent Amount %', 'Fixed Amount', 'Fixed Retention'].map(mode => (
              <button
                key={mode}
                onClick={() => updateConfig({ amountMode: mode as BotConfig['amountMode'] })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs transition-colors",
                  config.amountMode === mode ? "bg-primary text-black font-medium" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                )}
              >
                {mode}
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
            <label className="text-xs text-muted-foreground">Wallet Execution Order</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              <button 
                onClick={() => updateConfig({ executionOrder: 'Sequential' })}
                className={cn("flex-1 text-xs py-1.5 rounded-md transition-colors", config.executionOrder === 'Sequential' ? "bg-white/10 text-white" : "text-muted-foreground")}
              >Sequential</button>
              <button 
                onClick={() => updateConfig({ executionOrder: 'Random' })}
                className={cn("flex-1 text-xs py-1.5 rounded-md transition-colors", config.executionOrder === 'Random' ? "bg-white/10 text-white" : "text-muted-foreground")}
              >Random</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex justify-between items-center">
              Repeat Run
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
          <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#F3BA2F]" /> Gas Setting</span>
          <span className="text-xs font-normal text-muted-foreground bg-black/20 px-2 py-1 rounded-full border border-white/5 font-mono">Current: 0.10 gwei</span>
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground block">Gas Price (gwei)</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              {['Fixed', 'Auto', 'Random'].map(m => (
                <button 
                  key={m}
                  onClick={() => updateConfig({ gasPriceMode: m as any })}
                  className={cn("flex-1 text-[10px] py-1.5 rounded-md transition-colors", config.gasPriceMode === m ? "bg-white/10 text-white" : "text-muted-foreground")}
                >{m}</button>
              ))}
            </div>
            <Input type="number" step="0.01" value={config.gasPrice} onChange={e => updateConfig({gasPrice: Number(e.target.value)})} />
            
            <label className="text-xs text-muted-foreground flex justify-between items-center pt-2">
              EIP-1559 <Switch checked={config.eip1559} onChange={e => updateConfig({eip1559: e.target.checked})} />
            </label>
          </div>

          <div className="space-y-3">
            <label className="text-xs text-muted-foreground block">Gas Limit</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              {['Fixed', 'Auto', 'Random'].map(m => (
                <button 
                  key={m}
                  onClick={() => updateConfig({ gasLimitMode: m as any })}
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
            <div className="text-muted-foreground text-xs">Estimate Service Fee</div>
            <div className="font-mono text-white">0.004 BNB</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Estimate Volume</div>
            <div className="font-mono text-emerald-400 font-bold">{stats.volume.toFixed(4)} BNB <span className="text-muted-foreground font-normal text-xs">≈ ${(stats.volume * 608).toFixed(2)}</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Increased Txns</div>
            <div className="font-mono text-white text-xs">Buy {stats.buyTx} + Sell {stats.sellTx} = <span className="font-bold text-sm">{stats.buyTx + stats.sellTx}</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">BNB Price</div>
            <div className="font-mono text-white">$608</div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500/80 p-3 rounded-lg text-xs leading-relaxed">
        If it is a tax token, please add the contract address to the whitelist: <span className="font-mono text-amber-400 select-all">0xeB85C4e28aF444ce60Df31B6c670034c7f167c0a</span>
      </div>

      <Button 
        variant="premium" 
        size="lg" 
        className="w-full text-lg h-14 font-bold tracking-wide"
        onClick={startBot}
      >
        <Play className="w-5 h-5 mr-2 fill-black" /> RUN BOT
      </Button>

    </div>
  );
}
