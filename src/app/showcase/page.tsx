import { getPublicShowcaseProjects } from "@/server/actions/showcase";
import AnimatedShowcase from "@/components/showcase/AnimatedShowcase";
import LabStats from "@/components/showcase/LabStats";
import Footer from "@/components/ui/Footer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import FloatingPillNavbar from "@/components/ui/ShowCaseNavbar";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export default async function PublicShowcasePage() {
  const projects = await getPublicShowcaseProjects();

  const imgDir = path.join(process.cwd(), "public/images-rollingdisplay");

  let slideshowImages: string[] = [];

  try {
    const files = await fs.readdir(imgDir);

    slideshowImages = files
      .filter((file) => /\.(jpg|jpeg|png|webp|avif)$/i.test(file))
      .sort()
      .map((file) => `/images-rollingdisplay/${file}`);
  } catch (error) {
    console.error("[showcase-page] Failed to read image folder:", error);
  }

  return (
    <div className="relative min-h-screen bg-[#E5E5E5] dark:bg-[#050505]">
      <FloatingPillNavbar />
      <ThemeToggle />

      <main className="  relative z-10 pt-24 sm:pt-32 md:pt-40 lg:pt-0 bg-[#FAFAFA] dark:bg-[#111111] mb-[45vh] sm:mb-[50vh] md:mb-[80vh] transition-colors duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <AnimatedShowcase projects={projects || []} />
        <LabStats images={slideshowImages} />
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
