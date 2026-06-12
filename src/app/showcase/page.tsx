import { getPublicShowcaseProjects } from "@/server/actions/showcase";
import AnimatedShowcase from "@/components/showcase/AnimatedShowcase";
import LabStats from "@/components/showcase/LabStats";
import TextReveal from "@/components/showcase/TextReveal";
import InteractiveWorkflow from "@/components/showcase/InteractiveWorkflow";
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
    <div className="relative min-h-screen bg-background">
      <FloatingPillNavbar />
      <ThemeToggle />

      <main className="relative z-10 pt-24 sm:pt-32 md:pt-40 lg:pt-0 bg-transparent mb-[45vh] sm:mb-[50vh] md:mb-[80vh]">
        <AnimatedShowcase projects={projects || []} />
        
        <TextReveal text="We believe in the power of highly structured design systems. Stripping away unnecessary shadows, gradients, and noise reveals the raw mechanics of an application. This is brutalist engineering—content first, style as utility, functionality uncompromised." />

        <InteractiveWorkflow />

        <LabStats images={slideshowImages} />
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
