"use client";

import CallToAction from "@/components/landing/calltoaction";
import Features from "@/components/landing/features";
import Hero from "@/components/landing/hero";
import HowItWorks from "@/components/landing/howitworks";
import Showcase from "@/components/landing/showcase";
import StudyMaterials from "@/components/landing/studymaterials";
import { motion, useScroll, useSpring } from "framer-motion";

export default function Home() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <>
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-blue-500 origin-left z-50"
        style={{ scaleX }}
      />
      <main className="flex flex-col items-center justify-center w-full overflow-x-hidden">
        <Hero />
        <Features />
        <HowItWorks />
        <StudyMaterials />
        <CallToAction />
      </main>
    </>
  );
}
