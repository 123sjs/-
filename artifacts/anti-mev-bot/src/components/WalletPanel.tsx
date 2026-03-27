import * as React from "react";
import { useBotStore } from "@/store/use-bot-store";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { AppDialog } from "./ui/app-dialog";
import { formatAddress } from "@/lib/utils";
import { Download, RefreshCw, Trash2, Banknote, ExternalLink, Copy, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function WalletPanel() {
  const { wallets, toggleWalletSelection, setAllWalletSelection, deleteSelectedWallets, deleteWalletById, importWallets } = useBotStore();
  const [importOpen, setImportOpen] = React.useState(false);
  const [keysText, setKeysText] = React.useState("");
  const [revealedKeys, setRevealedKeys] = React.useState<Set<string>>(new Set());

  const handleImport = () => {
    if (keysText.trim()) {
      importWallets(keysText);
      setKeysText("");
      setImportOpen(false);
    }
  };

  const allSelected = wallets.length > 0 && wallets.every(w => w.selected);

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-lg overflow-hidden relative">
      
      {/* Tabs */}
      <div className="flex border-b border-border/50 bg-black/20">
        <button className="px-6 py-4 text-sm font-medium text-white border-b-2 border-primary bg-white/5">
          Private Key Operation
        </button>
        <button className="px-6 py-4 text-sm font-medium text-muted-foreground hover:text-white transition-colors">
          Wallet Operation
        </button>
      </div>

      {/* Actions Toolbar */}
      <div className="p-4 flex flex-wrap gap-2 items-center bg-black/10 border-b border-border/50">
        <Button size="sm" onClick={() => setImportOpen(true)} className="gap-2">
          <Download className="w-4 h-4" /> Import Wallet
        </Button>
        <Button size="sm" variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4 text-primary" /> Check balance
        </Button>
        
        <div className="w-px h-6 bg-border mx-1"></div>
        
        <Button size="sm" variant="ghost" onClick={() => setAllWalletSelection('zero')}>
          Select Bal 0
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAllWalletSelection('positive')}>
          Select Bal &gt; 0
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAllWalletSelection('invert')}>
          Invert
        </Button>
        <Button size="sm" variant="danger" onClick={deleteSelectedWallets} className="ml-auto" disabled={wallets.filter(w=>w.selected).length === 0}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
        </Button>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-black/20 min-h-[300px]">
        {wallets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Banknote className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm">Please import wallet</p>
            <Button size="sm" className="mt-4" onClick={() => setImportOpen(true)}>Import Now</Button>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-card/80 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="p-4 w-12">
                  <Checkbox 
                    checked={allSelected} 
                    onChange={() => setAllWalletSelection(allSelected ? 'none' : 'all')} 
                  />
                </th>
                <th className="p-4 font-medium">No.</th>
                <th className="p-4 font-medium">Address ({wallets.length})</th>
                <th className="p-4 font-medium text-right">BNB</th>
                <th className="p-4 font-medium text-right">USDT</th>
                <th className="p-4 font-medium text-center">Nonce</th>
                <th className="p-4 font-medium">Result</th>
                <th className="p-4 font-medium text-center">Options</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 > 0.5 ? 0 : i * 0.05 }}
                  key={w.id} 
                  className={cn(
                    "border-b border-white/5 transition-colors hover:bg-white/5",
                    w.selected ? "bg-primary/5" : ""
                  )}
                >
                  <td className="p-4">
                    <Checkbox 
                      checked={w.selected} 
                      onChange={() => toggleWalletSelection(w.id)} 
                    />
                  </td>
                  <td className="p-4 text-muted-foreground font-mono text-xs">{w.index}</td>
                  <td className="p-4 font-mono text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary/80 shrink-0"></div>
                      <span>{formatAddress(w.address)}</span>
                      <button
                        onClick={() => copyAddress(w.address)}
                        className="text-muted-foreground hover:text-white transition-colors"
                        title="Copy address"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <a
                        href={`https://bscscan.com/address/${w.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="View on BSCScan"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-400">{w.bnb.toFixed(4)}</td>
                  <td className="p-4 text-right font-mono text-white">{w.usdt}</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">{w.nonce}</td>
                  <td className="p-4">
                    {w.result === '-' ? (
                      <span className="text-muted-foreground">-</span>
                    ) : w.result.startsWith('✓') ? (
                      <span className="text-emerald-400">{w.result}</span>
                    ) : (
                      <span className="text-rose-400">{w.result}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => toggleReveal(w.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        title={revealedKeys.has(w.id) ? "Hide key" : "Show key"}
                      >
                        {revealedKeys.has(w.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteWalletById(w.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        title="Delete wallet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AppDialog open={importOpen} onOpenChange={setImportOpen} title="Import Wallets">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste your private keys below, one per line. They remain in your browser's local memory only.
          </p>
          <textarea
            className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm text-white focus:outline-none focus:border-primary transition-colors resize-none placeholder:text-white/20"
            placeholder="0xabc123...&#10;0xdef456..."
            value={keysText}
            onChange={(e) => setKeysText(e.target.value)}
          ></textarea>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} className="min-w-[120px]">Import</Button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
