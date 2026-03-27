import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import { WalletPanel } from "@/components/WalletPanel";
import { ConfigPanel } from "@/components/ConfigPanel";
import { BotLog } from "@/components/BotLog";
import { FAQSection } from "@/components/FAQSection";
import { RefreshCcw, X, Search, Bell } from "lucide-react";
import { useBotStore } from "@/store/use-bot-store";
import { formatAddress } from "@/lib/utils";

export default function BotPage() {
  const { isRunning, wallets, config, addLog, stopBot } = useBotStore();

  // The Bot Simulation Loop
  React.useEffect(() => {
    if (!isRunning) return;

    let timeoutId: number;

    const runTick = () => {
      const state = useBotStore.getState();
      const selectedWallets = state.wallets.filter(w => w.selected);

      // Stop condition: no wallets selected; also stop if repeatRun is enabled and limit reached
      const repeatLimitReached = state.config.repeatRun && state.runsCompleted >= state.config.repeatTimes;
      if (selectedWallets.length === 0 || repeatLimitReached) {
        stopBot();
        return;
      }

      // Pick a wallet based on execution order
      const wIdx = state.config.executionOrder === 'Random'
        ? Math.floor(Math.random() * selectedWallets.length)
        : state.runsCompleted % selectedWallets.length;
      const wallet = selectedWallets[wIdx];

      // Determine swap amount
      const amount = state.config.amountMode === 'Fixed'
        ? state.config.amountBNB.toFixed(4)
        : state.config.amountMode === 'All'
          ? wallet.bnb.toFixed(4)
          : (Math.random() * state.config.amountBNB).toFixed(4);

      const isBuy = Math.random() > 0.5;
      const hash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      addLog({
        wallet: formatAddress(wallet.address),
        action: isBuy ? 'Buy' : 'Sell',
        amount,
        hash: formatAddress(hash),
        status: Math.random() > 0.05 ? 'Success' : 'Failed',
      });

      // Schedule next tick; apply random delay if enabled
      const baseDelay = state.config.delay * 1000;
      const nextDelay = state.config.randomDelay
        ? Math.random() * baseDelay * 2 + 500
        : baseDelay;

      timeoutId = window.setTimeout(runTick, nextDelay);
    };

    // Start first tick after initial delay
    const initialDelay = config.randomDelay
      ? Math.random() * config.delay * 2000 + 500
      : config.delay * 1000;
    timeoutId = window.setTimeout(runTick, initialDelay);

    return () => clearTimeout(timeoutId);
  }, [isRunning, addLog, stopBot]);

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header / Breadcrumb */}
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground cursor-pointer hover:text-white transition-colors">Dashboard</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-white font-medium flex items-center gap-2">
              BSC Anti-MEV Volume Bot 🤖
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/5">
              <button className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white flex items-center gap-2 rounded-md hover:bg-white/5 transition-colors">
                <RefreshCcw className="w-3 h-3" /> Refresh
              </button>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white flex items-center gap-2 rounded-md hover:bg-white/5 transition-colors">
                <X className="w-3 h-3" /> Close
              </button>
            </div>
            <button className="relative w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full ring-2 ring-background"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-custom p-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            
            {/* Main Split Interface */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[600px] xl:h-[calc(100vh-200px)]">
              {/* Left Panel - Wallets */}
              <div className="xl:col-span-8 flex flex-col gap-6">
                <div className="flex-1">
                  <WalletPanel />
                </div>
                <div className="shrink-0">
                  <BotLog />
                </div>
              </div>

              {/* Right Panel - Config */}
              <div className="xl:col-span-4 h-full">
                <ConfigPanel />
              </div>
            </div>

            {/* Bottom FAQ / Promo */}
            <div className="pt-8 pb-12">
              <FAQSection />
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
