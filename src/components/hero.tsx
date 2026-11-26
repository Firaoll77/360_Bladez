"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const mobileImgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run the effect on mobile-sized viewports
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;

    function onScroll() {
      const el = mobileImgRef.current;
      if (!el) return;
      // scrollY 0 → scale 1, scrollY 400px → scale 1.18
      const scale = 1 + Math.min(window.scrollY / 400, 1) * 0.18;
      el.style.transform = `scale(${scale})`;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="top" className="relative min-h-screen overflow-hidden bg-[#020202]">
      {/* Mobile image wrapper — transform origin at top so zoom feels anchored */}
      <div
        ref={mobileImgRef}
        className="absolute inset-0 origin-top will-change-transform md:hidden"
      >
        <Image
          src="/mob.jpg"
          alt="The Art of the Cut — 360_Bladez"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_top]"
        />
      </div>

      {/* Desktop photo: framed so model and face are strictly positioned on the left side */}
      <Image
        src="/heros.jpg"
        alt="The Art of the Cut — 360_Bladez"
        fill
        priority
        sizes="100vw"
        className="hidden object-cover object-left md:block"
      />

      {/* Mobile shadow: gradient from bottom so text sits in deep shadow below the model */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/85 via-50% to-transparent md:hidden" />

      {/* Desktop shadow: seamless blend into the deep black shadow on the right */}
      <div className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-[#020202]/20 to-[#020202] md:block" />

      {/* Main hero grid */}
      <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center px-6 pt-24 pb-16 md:grid-cols-12 md:px-8 lg:px-12">
        {/* Left column empty on desktop so model's haircut profile is completely unobstructed */}
        <div className="hidden md:block md:col-span-6 lg:col-span-7 xl:col-span-7" />

        {/* Right column: bold typography slightly lowered on mobile and to the right on desktop */}
        <div className="flex flex-col justify-center pt-12 md:pt-0 md:col-span-6 lg:col-span-5 xl:col-span-5 md:pl-8 lg:pl-14 xl:pl-18">
          <h1 className="font-display flex flex-col text-[clamp(3.8rem,9vw,8rem)] font-bold uppercase leading-[0.88] tracking-[0.06em] text-white drop-shadow-md">
            <span>THE ART</span>
            <span>OF THE</span>
            <span>CUT</span>
          </h1>

          {/* Quick Action CTA button with before & after transform effects */}
          <div className="mt-8 md:mt-10">
            <Link
              href="/book"
              className="relative inline-flex w-fit items-center justify-center overflow-hidden rounded-[4px] bg-accent px-8 py-3.5 font-display text-lg sm:text-xl font-semibold tracking-wider uppercase text-dark shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(193,160,92,0.45)] active:translate-y-0.5 active:scale-[0.94] active:bg-accent/90 active:shadow-none active:transition-transform before:absolute before:inset-0 before:-translate-x-full before:-skew-x-12 before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full"
            >
              <span>Book Appointment</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
