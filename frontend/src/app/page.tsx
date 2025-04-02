import CallToAction from "@/components/landing/calltoaction";
import Features from "@/components/landing/features";
import Hero from "@/components/landing/hero";
import HowItWorks from "@/components/landing/howitworks";
import Showcase from "@/components/landing/showcase";
import StudyMaterials from "@/components/landing/studymaterials";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Hero />
      <Features />
      <HowItWorks />
      <StudyMaterials />
      <Showcase />
      <CallToAction />
    </div>
  );
}
