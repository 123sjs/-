import * as React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Droplet, ArrowRightLeft, ShieldAlert, 
  Banknote, Settings, Box, Bot, ChevronDown, Rocket, Search,
  Zap, Languages
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiSolana } from "react-icons/si";
import { useLang } from "@/i18n/useLang";

export function Sidebar() {
  const [location] = useLocation();
  const { lang, setLang, t } = useLang();
  const s = t.sidebar;

  const navItems = [
    { icon: LayoutDashboard, label: s.dashboard, href: "/dashboard" },
    { 
      icon: SiSolana, label: "SOL", href: "#", 
      children: [
        { label: s.createToken, href: "#" },
        { label: s.increaseHolders, href: "#" },
        { label: s.tokenAutoSell, href: "#" },
      ]
    },
    { 
      icon: Droplet, label: s.airdrop, href: "#",
      children: [
        { label: s.airdropsList, href: "#" },
        { label: s.createAirdrop, href: "#" },
      ]
    },
    { icon: ArrowRightLeft, label: s.marketMaker, href: "#" },
    { 
      icon: Bot, label: s.antMevBot, href: "/", active: true,
      defaultOpen: true,
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
    { icon: Zap, label: s.launchPipeline, href: "/launch-pipeline" },
    { icon: Box, label: s.bundledSell, href: "#" },
    { icon: ShieldAlert, label: s.auditContract, href: "#" },
    { icon: Rocket, label: s.nft, href: "#" },
    { icon: Settings, label: s.chainTools, href: "#" },
    { icon: Banknote, label: s.walletsManage, href: "#" },
  ];

  type NavItem = typeof navItems[0];

  const [openSections, setOpenSections] = React.useState<Record<number, boolean>>(
    () => navItems.reduce((acc, item, i) => {
      if ("children" in item && item.children) acc[i] = (item as any).defaultOpen ?? false;
      return acc;
    }, {} as Record<number, boolean>)
  );

  const toggleSection = (idx: number) => {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col hidden lg:flex sticky top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(0,208,133,0.4)]">
            CT
          </div>
          <span className="font-bold text-lg text-white">CoinTool</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground ml-1">V3.0</span>
        </div>
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-colors text-muted-foreground hover:text-white"
          title={lang === "zh" ? "Switch to English" : "切换为中文"}
        >
          <Languages className="w-3 h-3" />
          {lang === "zh" ? "EN" : "中"}
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={s.search}
            className="w-full bg-black/20 border border-white/5 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground transition-colors"
          />
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto scrollbar-custom p-3 space-y-1">
        {navItems.map((item, i) => (
          <div key={i}>
            {"children" in item && item.children ? (
              <div className="mb-1">
                <button
                  onClick={() => toggleSection(i)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    (item as any).active ? "text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-4 h-4", (item as any).active && "text-primary")} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform duration-200", openSections[i] && "rotate-180")} />
                </button>
                {openSections[i] && (
                  <div className="ml-9 mt-1 space-y-1 border-l border-white/5 pl-2">
                    {item.children.map((child, j) => (
                      <Link key={j} href={child.href} className={cn(
                        "block px-3 py-2 rounded-lg text-sm transition-colors",
                        (child as any).active 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-muted-foreground hover:text-white hover:bg-white/5"
                      )}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                (item as any).active 
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
        <a href="#" className="hover:text-white transition-colors">{s.widgets}</a>
        <a href="#" className="hover:text-white transition-colors">{s.mediaKit}</a>
        <a href="#" className="hover:text-white transition-colors">{s.contact}</a>
      </div>
    </div>
  );
}
