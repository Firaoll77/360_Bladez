import { Hero } from "@/components/hero";
import { HoursSection } from "@/components/sections";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Hero />
      <HoursSection />
    </>
  );
}
