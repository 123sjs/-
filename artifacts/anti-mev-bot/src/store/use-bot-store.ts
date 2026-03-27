import { create } from 'zustand';
import { generateMockAddress } from '@/lib/utils';

export type Wallet = {
  id: string;
  index: number;
  address: string;
  privateKey: string;
  bnb: number;
  usdt: number;
  nonce: number;
  result: string;
  selected: boolean;
};

export type LogEntry = {
  id: string;
  time: string;
  wallet: string;
  action: 'Buy' | 'Sell';
  amount: string;
  hash: string;
  status: 'Success' | 'Failed';
};

export type BotConfig = {
  chain: string;
  rpc: string;
  delay: number;
  randomDelay: boolean;
  threads: number;
  dex: string;
  amountMode: 'All' | 'Random' | 'Percent' | 'Fixed' | 'Fixed Retention';
  amountBNB: number;
  executionOrder: 'Sequential' | 'Random';
  repeatRun: boolean;
  repeatTimes: number;
  gasPriceMode: 'Fixed' | 'Auto' | 'Random';
  gasPrice: number;
  floatingGas: number;
  eip1559: boolean;
  gasLimitMode: 'Fixed' | 'Auto' | 'Random';
  gasLimit: number;
};

interface BotState {
  wallets: Wallet[];
  logs: LogEntry[];
  config: BotConfig;
  isRunning: boolean;
  runsCompleted: number;
  stats: {
    fee: number;
    volume: number;
    buyTx: number;
    sellTx: number;
  };
  
  // Actions
  importWallets: (keys: string) => void;
  toggleWalletSelection: (id: string) => void;
  setAllWalletSelection: (mode: 'all' | 'zero' | 'positive' | 'invert' | 'none') => void;
  deleteSelectedWallets: () => void;
  deleteWalletById: (id: string) => void;
  updateConfig: (updates: Partial<BotConfig>) => void;
  startBot: () => void;
  stopBot: () => void;
  addLog: (log: Omit<LogEntry, 'id' | 'time'>) => void;
}

const DEFAULT_CONFIG: BotConfig = {
  chain: 'BSC',
  rpc: 'https://bsc-dataseed1.binance.org',
  delay: 2,
  randomDelay: false,
  threads: 1,
  dex: 'Auto(V3&V2)',
  amountMode: 'Random',
  amountBNB: 0.1,
  executionOrder: 'Sequential',
  repeatRun: true,
  repeatTimes: 10,
  gasPriceMode: 'Fixed',
  gasPrice: 0.1,
  floatingGas: 10,
  eip1559: false,
  gasLimitMode: 'Auto',
  gasLimit: 300000,
};

export const useBotStore = create<BotState>((set, get) => ({
  wallets: [],
  logs: [],
  config: DEFAULT_CONFIG,
  isRunning: false,
  runsCompleted: 0,
  stats: {
    fee: 0.004,
    volume: 0,
    buyTx: 0,
    sellTx: 0,
  },

  importWallets: (keys: string) => {
    const lines = keys.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const startIndex = get().wallets.length + 1;
    
    const newWallets: Wallet[] = lines.map((key, i) => {
      const bnbBal = Number((Math.random() * 0.5).toFixed(4));
      return {
        id: crypto.randomUUID(),
        index: startIndex + i,
        address: generateMockAddress(key),
        privateKey: key,
        bnb: bnbBal,
        usdt: Math.floor(Math.random() * 500),
        nonce: Math.floor(Math.random() * 10),
        result: '-',
        selected: true,
      };
    });

    set((state) => ({ wallets: [...state.wallets, ...newWallets] }));
  },

  toggleWalletSelection: (id: string) => {
    set((state) => ({
      wallets: state.wallets.map(w => w.id === id ? { ...w, selected: !w.selected } : w)
    }));
  },

  setAllWalletSelection: (mode) => {
    set((state) => ({
      wallets: state.wallets.map(w => {
        let selected = w.selected;
        if (mode === 'all') selected = true;
        if (mode === 'none') selected = false;
        if (mode === 'zero') selected = w.bnb === 0;
        if (mode === 'positive') selected = w.bnb > 0;
        if (mode === 'invert') selected = !w.selected;
        return { ...w, selected };
      })
    }));
  },

  deleteSelectedWallets: () => {
    set((state) => ({
      wallets: state.wallets.filter(w => !w.selected).map((w, i) => ({ ...w, index: i + 1 }))
    }));
  },

  deleteWalletById: (id: string) => {
    set((state) => ({
      wallets: state.wallets.filter(w => w.id !== id).map((w, i) => ({ ...w, index: i + 1 }))
    }));
  },

  updateConfig: (updates) => {
    set((state) => ({ config: { ...state.config, ...updates } }));
  },

  startBot: () => {
    const state = get();
    if (state.wallets.filter(w => w.selected).length === 0) {
      alert('Please import and select at least one wallet.');
      return;
    }
    set({ isRunning: true, runsCompleted: 0 });
  },

  stopBot: () => set({ isRunning: false }),

  addLog: (logInput) => {
    const log: LogEntry = {
      ...logInput,
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
    };
    
    set((state) => {
      const isBuy = log.action === 'Buy';
      const volIncrease = Number(log.amount);
      
      return {
        logs: [log, ...state.logs].slice(0, 100), // Keep last 100
        runsCompleted: state.runsCompleted + 1,
        stats: {
          ...state.stats,
          volume: state.stats.volume + volIncrease,
          buyTx: state.stats.buyTx + (isBuy ? 1 : 0),
          sellTx: state.stats.sellTx + (isBuy ? 0 : 1),
        }
      };
    });
  }
}));
