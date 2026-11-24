import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const services = [
    { name: "Classic Haircut", description: "Precision cut, wash and style.", durationMin: 30, priceETB: 300 },
    { name: "Haircut + Beard Trim", description: "Full cut with beard sculpt and hot towel finish.", durationMin: 45, priceETB: 450 },
    { name: "Beard Sculpt", description: "Line-up, shaping and conditioning.", durationMin: 25, priceETB: 250 },
    { name: "Kids Haircut (under 12)", description: "Patient, quick cut for the little ones.", durationMin: 20, priceETB: 200 },
    { name: "Fade & Design", description: "Skin fade with custom line art or design.", durationMin: 60, priceETB: 600 },
    { name: "Full Grooming", description: "Cut, beard, facial and style — the complete experience.", durationMin: 90, priceETB: 800 },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: `svc-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}` },
      update: {},
      create: { id: `svc-${s.name.toLowerCase().replace(/[^a-z]+/g, "-")}`, ...s },
    });
  }

  const barbers = [
    { name: "Kaleb T.", specialty: "Fades & Design", bio: "Award-winning fade specialist with 8 years behind the chair.", photoUrl: "/barbers/kaleb.jpg" },
    { name: "Yonatan B.", specialty: "Classic Cuts", bio: "Traditional barbering with a modern edge.", photoUrl: "/barbers/yonatan.jpg" },
    { name: "Dawit M.", specialty: "Beard & Shave", bio: "Hot-towel shaves and beard artistry.", photoUrl: "/barbers/dawit.jpg" },
    { name: "Samuel A.", specialty: "Kids & Family", bio: "Gentle hands, patient spirit — great with kids.", photoUrl: "/barbers/samuel.jpg" },
  ];

  for (const b of barbers) {
    await prisma.barber.upsert({
      where: { id: `barber-${b.name.toLowerCase().replace(/[^a-z]+/g, "-")}` },
      update: { photoUrl: b.photoUrl, specialty: b.specialty, bio: b.bio },
      create: { id: `barber-${b.name.toLowerCase().replace(/[^a-z]+/g, "-")}`, ...b },
    });
  }

  console.log("Seeded services and barbers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
