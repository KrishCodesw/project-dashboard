import Link from "next/link";
import Image from "next/image";
import { 
  HomeIcon, 
  LayoutDashboard, 
  Briefcase, 
  Code2, 
  BarChart3 
} from "lucide-react";

export default function FloatingPillNavbar() {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-max max-w-[98vw]">
      <div className="flex items-center gap-2 sm:gap-4 p-1.5 sm:px-6 sm:py-3 rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#0A0A0A]/80 backdrop-blur-md shadow-lg">
        
        {/* LOGO */}
        <Link
          href="https://www.tcetmumbai.in/"
          className="flex items-center justify-center shrink-0 bg-white rounded-full w-8 h-8 sm:w-9 sm:h-9 overflow-hidden"
        >
          <img
            src="/tcetlogo.png"
            alt="TCET Logo"
            className="w-full h-full object-contain p-1"
          />
        </Link>

        <div className="w-[1px] h-4 sm:h-6 bg-black/10 dark:bg-white/10" />

        {/* NAVIGATION */}
        <nav className="flex items-center gap-1 sm:gap-4 font-montreal text-[10px] sm:text-xs uppercase tracking-widest">
          {/* HOME */}
          <Link
            href="/showcase"
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors flex items-center gap-2 group"
            title="Home"
          >
            <HomeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white" />
            <span className="hidden lg:inline-block text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white">Home</span>
          </Link>

          {/* MAJOR PROJECTS */}
          <Link
            href="/majorprojects"
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors flex items-center gap-2 group"
            title="Major Projects"
          >
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white" />
            <span className="hidden md:inline-block text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white">Major</span>
          </Link>

          {/* RBL PROJECTS */}
          <Link
            href="/rblprojects-te"
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors flex items-center gap-2 group"
            title="RBL Projects"
          >
            <Code2 className="w-4 h-4 sm:w-5 sm:h-5 text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white" />
            <span className="hidden md:inline-block text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white">RBL</span>
          </Link>

          {/* ANALYTICS */}
          <Link
            href="/analytics"
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors flex items-center gap-2 group"
            title="Analytics"
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white" />
            <span className="hidden md:inline-block text-black/60 dark:text-white/60 group-hover:text-black dark:group-hover:text-white">Analytics</span>
          </Link>
        </nav>

        <div className="w-[1px] h-4 sm:h-6 bg-black/10 dark:bg-white/10" />

        {/* DASHBOARD BUTTON */}
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-all text-[10px] sm:text-xs font-bold uppercase tracking-wider"
        >
          <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline-block">Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
