"use client";

import React, { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import FloatingPillNavbar from "@/components/ui/ShowCaseNavbar";
import { getPublicShowcaseProjectById } from "@/server/actions/showcase";
import Footer from "@/components/ui/Footer";
import { ExternalLink, Github, FileText, ArrowLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STAGGER_CHILDREN = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

const CONTAINER_STAGGER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function ShowcaseProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  // Note: Since this is now a client component (for animations), we would typically 
  // fetch data via a hook or pass it from a server wrapper. 
  // However, for this redesign, I will keep the structure and focus on the UI.
  // Ideally, this would be a server component that passes data to a client layout.
  // To keep it simple and effective, I'll assume the data is fetched.
  
  const [project, setProject] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      const data = await getPublicShowcaseProjectById(projectId);
      setProject(data);
      setLoading(false);
    }
    fetchData();
  }, [projectId]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!project) notFound();

  const screenshots = project.assets?.filter((asset: any) => asset.kind === "SCREENSHOT") || [];
  const documentationFiles = project.assets?.filter((asset: any) => asset.kind === "DOCUMENTATION") || [];
  const heroVisual = screenshots[0]?.accessUrl || screenshots[0]?.fileUrl;

  return (
    <div className="min-h-screen bg-background text-black dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      <FloatingPillNavbar />

      <main className="relative z-10 bg-background max-w-7xl mx-auto px-6 pt-32 pb-24 mb-[60vh] md:mb-[80vh]">
        
        {/* BACK LINK */}
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mb-12"
        >
          <Link
            href="/showcase"
            className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors active:scale-95 w-fit"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Showcase
          </Link>
        </motion.div>

        {/* HERO SECTION */}
        <motion.header 
          variants={CONTAINER_STAGGER}
          initial="hidden"
          animate="visible"
          className="mb-20"
        >
          <motion.div variants={STAGGER_CHILDREN} className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">
              {project.category || "Research Project"}
            </span>
            <div className="h-px w-12 bg-black/10 dark:bg-white/10" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">
              {new Date(project.createdAt).getFullYear()}
            </span>
          </motion.div>

          <motion.h1 
            variants={STAGGER_CHILDREN}
            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] mb-8"
          >
            {project.title.toUpperCase()}
          </motion.h1>

          <motion.p 
            variants={STAGGER_CHILDREN}
            className="text-xl sm:text-2xl text-black/60 dark:text-white/60 max-w-3xl font-medium leading-tight"
          >
            {project.shortDescription || "An academic project developed by the students of TCET."}
          </motion.p>
        </motion.header>

        {/* MAIN VISUAL */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="relative aspect-[21/9] w-full bg-black/5 dark:bg-white/5 rounded-sm overflow-hidden mb-24 border border-black/5 dark:border-white/5"
        >
          {heroVisual ? (
            <img
              src={heroVisual}
              alt={project.title}
              className="w-full h-full object-cover grayscale-[0.2] contrast-[1.1]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          
          {/* CONTENT COLUMN */}
          <div className="lg:col-span-8 space-y-24">
            
            <Section title="Abstract">
              <p className="text-lg text-black/60 dark:text-white/60 leading-relaxed font-medium whitespace-pre-wrap">
                {project.fullDescription}
              </p>
            </Section>

            {project.problemStatement && (
              <Section title="Problem">
                <p className="text-lg text-black/60 dark:text-white/60 leading-relaxed font-medium whitespace-pre-wrap">
                  {project.problemStatement}
                </p>
              </Section>
            )}

            {project.methodology && (
              <Section title="Methodology">
                <p className="text-lg text-black/60 dark:text-white/60 leading-relaxed font-medium whitespace-pre-wrap">
                  {project.methodology}
                </p>
              </Section>
            )}

            {/* GALLERY */}
            {screenshots.length > 1 && (
              <Section title="Gallery">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {screenshots.slice(1).map((shot: any, i: number) => (
                    <motion.a
                      key={shot.id}
                      href={shot.accessUrl || shot.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                      className="group relative aspect-video bg-black/5 dark:bg-white/5 rounded-sm overflow-hidden border border-black/5 dark:border-white/5 active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={shot.accessUrl || shot.fileUrl}
                        alt="Project screenshot"
                        className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <ExternalLink className="w-6 h-6 text-white" />
                      </div>
                    </motion.a>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="lg:col-span-4 space-y-16">
            
            {/* LINKS */}
            {(project.liveDemoUrl || project.githubUrl) && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Links</h3>
                <div className="flex flex-col gap-3">
                  {project.liveDemoUrl && (
                    <Link
                      href={project.liveDemoUrl}
                      className="h-12 px-6 flex items-center justify-between rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-bold transition-all active:scale-[0.97]"
                    >
                      Live Demo
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                  {project.githubUrl && (
                    <Link
                      href={project.githubUrl}
                      className="h-12 px-6 flex items-center justify-between rounded-full border border-black/10 dark:border-white/20 text-sm font-bold transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97]"
                    >
                      Source Code
                      <Github className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* TEAM */}
            <div className="space-y-8">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Project Team</h3>
              <div className="space-y-6">
                {project.teamMembers?.map((member: any) => (
                  <div key={member.id} className="group">
                    <p className="text-lg font-black tracking-tight group-hover:text-black/60 dark:group-hover:text-white/60 transition-colors">
                      {member.name.toUpperCase()}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-1">
                      {member.role}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* TECH STACK */}
            {project.techStack && (project.techStack as string[]).length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {(project.techStack as string[]).map((tech) => (
                    <span
                      key={tech}
                      className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-black/5 dark:border-white/5"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* DOCUMENTATION */}
            {documentationFiles.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Documentation</h3>
                <div className="space-y-2">
                  {documentationFiles.map((doc: any, i: number) => (
                    <a
                      key={i}
                      href={doc.accessUrl || doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-sm bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/10 transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 opacity-40" />
                        <span className="text-sm font-bold uppercase tracking-widest">
                          {doc.fileName || `Document ${i + 1}`}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-8"
    >
      <div className="flex items-center gap-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/40 dark:text-white/40 shrink-0">
          {title}
        </h2>
        <div className="h-px flex-1 bg-black/5 dark:bg-white/10" />
      </div>
      {children}
    </motion.section>
  );
}
