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
      .sort((a, b) => {
        // Extract numbers for proper numerical sorting (i1, i2, ..., i10)
        const numA = parseInt(a.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.replace(/\D/g, "")) || 0;
        return numA - numB;
      })
      .map((file) => `/images-rollingdisplay/${file}`);
  } catch (error) {
    console.error("[showcase-page] Failed to read image folder:", error);
  }

  return (
    <div className="relative min-h-screen bg-background ">
      <FloatingPillNavbar />
      <ThemeToggle />

      <main className="relative z-10 pt-24 sm:pt-32 md:pt-40 lg:pt-0 bg-background mb-[60vh] md:mb-[80vh] shadow-[0_8px_60px_rgba(0,0,0,0.18)] rounded-b-3xl">
        {" "}
        <AnimatedShowcase projects={projects || []} />
        <LabStats images={slideshowImages} />
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
