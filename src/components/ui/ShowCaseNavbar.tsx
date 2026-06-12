"use client";

import Link from "next/link";
import { 
  HomeIcon, 
  LayoutDashboard, 
  Briefcase, 
  Code2, 
  BarChart3 
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/showcase", label: "Home", icon: HomeIcon },
  { href: "/majorprojects", label: "Major", icon: Briefcase },
  { href: "/rblprojects-te", label: "RBL", icon: Code2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function FloatingPillNavbar() {
  const pathname = usePathname();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-max max-w-[98vw]">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center gap-2 sm:gap-4 p-1.5 sm:px-6 sm:py-3 rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        {/* LOGO */}
        <Link
          href="https://www.tcetmumbai.in/"
          className="flex items-center justify-center shrink-0 bg-white rounded-full w-8 h-8 sm:w-9 sm:h-9 overflow-hidden transition-transform active:scale-95 duration-150"
        >
          <img
            src="/tcetlogo.png"
            alt="TCET Logo"
            className="w-full h-full object-contain p-1.5"
          />
        </Link>

        <div className="w-[1px] h-4 bg-black/5 dark:bg-white/10" />

        {/* NAVIGATION */}
        <nav className="flex items-center gap-1 sm:gap-1.5 font-sans text-[10px] sm:text-xs uppercase tracking-[0.15em] font-semibold">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative p-2 sm:px-4 sm:py-2 rounded-full transition-all duration-200 active:scale-95",
                  isActive 
                    ? "text-black dark:text-white" 
                    : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative flex items-center gap-2">
                  <item.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span className="hidden md:inline-block">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="w-[1px] h-4 bg-black/5 dark:bg-white/10" />

        {/* DASHBOARD BUTTON */}
        <Link
          href="/"
          className="group relative flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black transition-all duration-200 active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" />
          <span className="relative z-10 text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:inline-block">
            Dashboard
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
