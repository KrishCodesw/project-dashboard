"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  className?: string;
}

export default function TextReveal({ text, className }: TextRevealProps) {
  const container = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start 80%", "end 20%"],
  });

  const words = text.split(" ");

  return (
    <div
      ref={container}
      className={cn(
        "relative w-full max-w-5xl mx-auto py-[20vh] flex items-center justify-center px-6",
        className
      )}
    >
      <p className="flex flex-wrap gap-x-[0.3em] gap-y-2 text-3xl md:text-5xl lg:text-6xl font-serif leading-[1.2] text-foreground">
        {words.map((word, i) => {
          const start = i / words.length;
          const end = start + 1 / words.length;
          return (
            <Word key={i} progress={scrollYProgress} range={[start, end]}>
              {word}
            </Word>
          );
        })}
      </p>
    </div>
  );
}

const Word = ({
  children,
  progress,
  range,
}: {
  children: string;
  progress: any;
  range: [number, number];
}) => {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <span className="relative">
      <span className="absolute opacity-15">{children}</span>
      <motion.span style={{ opacity: opacity }}>{children}</motion.span>
    </span>
  );
};
