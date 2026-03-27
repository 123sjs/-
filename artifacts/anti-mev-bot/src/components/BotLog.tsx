import * as React from "react";
import { useBotStore } from "@/store/use-bot-store";
import { Terminal, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function BotLog() {
  const { logs } = useBotStore();

  return (
    <div className="h-64 bg-black/60 rounded-xl border border-white/10 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-mono font-medium text-white flex items-center gap-2">
          <Terminal className="w-3 h-3 text-primary" /> Execution Log
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">Running locally</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 h-full flex items-center justify-center">
            Waiting for bot to start...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 border-b border-white/5 pb-2"
              >
                <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                <span className="text-blue-400 shrink-0">{log.wallet}</span>
                <span className={log.action === 'Buy' ? "text-emerald-400 w-8 shrink-0" : "text-rose-400 w-8 shrink-0"}>{log.action}</span>
                <span className="text-white shrink-0">{log.amount} BNB</span>
                <span className="text-muted-foreground truncate flex-1">{log.hash}</span>
                {log.status === 'Success' ? (
                  <span className="text-emerald-400 flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3"/> Success</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1 shrink-0"><XCircle className="w-3 h-3"/> Failed</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
