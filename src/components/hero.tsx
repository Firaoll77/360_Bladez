import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#020202]">
      {/* Mobile photo: centered on model's face, fade profile and barber pole */}
      <Image
        src="/mob.jpg"
        alt="The Art of the Cut — 360_Bladez"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_top] md:hidden"
      />
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
              className="group relative inline-flex w-fit items-center justify-center overflow-hidden rounded-[4px] bg-accent px-8 py-3.5 font-display text-lg sm:text-xl font-semibold tracking-wider uppercase text-dark shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(193,160,92,0.45)] active:translate-y-0 active:scale-[0.98] active:shadow-sm before:absolute before:inset-0 before:-translate-x-full before:-skew-x-12 before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full"
            >
              <span>Book Appointment</span>
              <span className="ml-2.5 inline-block transition-transform duration-300 ease-out group-hover:translate-x-1.5">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
