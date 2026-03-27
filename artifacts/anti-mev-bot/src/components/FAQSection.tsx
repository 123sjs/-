import * as React from "react";
import { ChevronDown, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const FAQs = [
  {
    q: "How to use BSC Anti-MEV Volume Bot 🤖?",
    a: "1. Import all the wallets you want to brush volume.\n2. Ensure that all your wallets have enough balance.\n3. Fill in Config and click RUN 🚀"
  },
  {
    q: "How to send multi-wallet amount to 1 wallet?",
    a: "Use our BSC Batch Collection tool from the sidebar to easily consolidate funds."
  },
  {
    q: "How much does BSC Anti-MEV Volume Bot cost per use?",
    a: "Lowest service fee in the entire network, each volume brushing only 0.002 BNB. After opening VIP, the fee is 0 BNB!"
  },
  {
    q: "CoinTool Is it safe to import wallets?",
    a: "1. CoinTool will never record any private keys, and the code is open source for verification!\n2. All information is read locally and CoinTool has been running stably for many years without any security incidents."
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 to-black z-0"></div>
        <img 
          src={`${import.meta.env.BASE_URL}images/vip-bg.png`} 
          alt="VIP Background" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 group-hover:scale-105 transition-transform duration-1000" 
        />
        <div className="relative z-10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" /> Upgrade to VIP
            </h3>
            <p className="text-sm text-emerald-100/70 mt-1 max-w-md">
              Get 0 BNB service fees on all bot transactions, priority MEV routes, and advanced analytics.
            </p>
          </div>
          <Button variant="premium" className="shrink-0 whitespace-nowrap">
            Open VIP Now
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-lg p-6">
        <h3 className="text-lg font-display font-bold text-white mb-4">FAQs</h3>
        <div className="space-y-2">
          {FAQs.map((faq, i) => (
            <div key={i} className="border border-white/5 rounded-xl bg-black/20 overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-white/5 transition-colors"
              >
                <span className="font-medium text-sm text-white">{faq.q}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openIndex === i ? "rotate-180" : "")} />
              </button>
              <div 
                className={cn(
                  "px-5 text-sm text-muted-foreground overflow-hidden transition-all duration-300",
                  openIndex === i ? "py-4 border-t border-white/5 max-h-[200px]" : "max-h-0 py-0"
                )}
              >
                <div className="whitespace-pre-line leading-relaxed">{faq.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
