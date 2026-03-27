import * as React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Droplet, ArrowRightLeft, ShieldAlert, 
  Banknote, Settings, Box, Bot, ChevronDown, Rocket, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiSolana } from "react-icons/si";

type NavChild = { label: string; href: string; active?: boolean };
type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { 
    icon: SiSolana, label: "SOL", href: "#", 
    children: [
      { label: "Create Token", href: "#" },
      { label: "Increase Holders", href: "#" },
      { label: "Token Auto Sell", href: "#" },
    ]
  },
  { 
    icon: Droplet, label: "Airdrop", href: "#",
    children: [
      { label: "Airdrops List", href: "#" },
      { label: "Create Airdrop", href: "#" },
    ]
  },
  { icon: ArrowRightLeft, label: "Market maker - Batch Swap", href: "#" },
  { 
    icon: Bot, label: "Anti-MEV Volume Bot🤖", href: "/", active: true,
    children: [
      { label: "Solana", href: "#" },
      { label: "ETH", href: "#" },
      { label: "BSC", href: "/", active: true },
      { label: "Arbitrum", href: "#" },
      { label: "Base", href: "#" },
      { label: "Optimism", href: "#" },
      { label: "Avalanche C", href: "#" },
    ]
  },
  { icon: Box, label: "Bundled Sell/Buy Token", href: "#" },
  { icon: ShieldAlert, label: "Audit Contract", href: "#" },
  { icon: Rocket, label: "NFT", href: "#" },
  { icon: Settings, label: "Chain Tools", href: "#" },
  { icon: Banknote, label: "Wallets Manage", href: "#" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col hidden lg:flex sticky top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(0,208,133,0.4)]">
            CT
          </div>
          <span className="font-display font-bold text-lg text-white">CoinTool</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground ml-1">V3.0</span>
        </div>
      </div>

      {/* Search mock */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search tools..." 
            className="w-full bg-black/20 border border-white/5 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground transition-colors"
          />
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto scrollbar-custom p-3 space-y-1">
        {navItems.map((item, i) => (
          <div key={i}>
            {item.children ? (
              <div className="mb-1">
                <button className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  item.active ? "text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
                )}>
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-4 h-4", item.active && "text-primary")} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </button>
                <div className="ml-9 mt-1 space-y-1 border-l border-white/5 pl-2">
                  {item.children.map((child, j) => (
                    <Link key={j} href={child.href} className={cn(
                      "block px-3 py-2 rounded-lg text-sm transition-colors",
                      child.active 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                item.active 
                  ? "bg-primary/10 text-primary" 
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
              )}>
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Footer links */}
      <div className="p-4 border-t border-sidebar-border shrink-0 text-xs text-muted-foreground flex justify-between">
        <a href="#" className="hover:text-white transition-colors">Widgets</a>
        <a href="#" className="hover:text-white transition-colors">Media kit</a>
        <a href="#" className="hover:text-white transition-colors">Contact</a>
      </div>
    </div>
  );
}
