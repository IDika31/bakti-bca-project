import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("Seeding database...");

  // Restaurant Profile
  await prisma.restaurantProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Rumah Makan Nusantara",
      description: "Sajian masakan Nusantara autentik dengan cita rasa rumahan",
      address: "Jl. Contoh No. 123, Jakarta",
      phone: "021-12345678",
    },
  });

  // Tax & Service Config
  await prisma.taxServiceConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      taxEnabled: true,
      taxPercentage: 10,
      taxLabel: "PB1",
      serviceEnabled: true,
      servicePercentage: 5,
      serviceLabel: "Service Charge",
    },
  });

  // Tripay Config (empty sandbox)
  await prisma.tripayConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      mode: "SANDBOX",
    },
  });

  // Operating Hours (Mon-Sun, 09:00-22:00)
  const days = [
    { dayOfWeek: 0, isClosed: false }, // Minggu
    { dayOfWeek: 1, isClosed: false }, // Senin
    { dayOfWeek: 2, isClosed: false }, // Selasa
    { dayOfWeek: 3, isClosed: false }, // Rabu
    { dayOfWeek: 4, isClosed: false }, // Kamis
    { dayOfWeek: 5, isClosed: false }, // Jumat
    { dayOfWeek: 6, isClosed: false }, // Sabtu
  ];

  for (const day of days) {
    await prisma.operatingHours.upsert({
      where: { dayOfWeek: day.dayOfWeek },
      update: {},
      create: {
        dayOfWeek: day.dayOfWeek,
        openTime: "09:00",
        closeTime: "22:00",
        isClosed: day.isClosed,
      },
    });
  }

  // Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { name: "Makanan Utama", sortOrder: 1 },
    }),
    prisma.category.create({
      data: { name: "Minuman", sortOrder: 2 },
    }),
    prisma.category.create({
      data: { name: "Snack & Appetizer", sortOrder: 3 },
    }),
    prisma.category.create({
      data: { name: "Dessert", sortOrder: 4 },
    }),
  ]);

  const [makanan, minuman, snack, dessert] = categories;

  // Menu Items
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Nasi Goreng Spesial",
        description: "Nasi goreng dengan telur, ayam, dan sayuran segar",
        price: 35000,
        categoryId: makanan.id,
      },
      {
        name: "Mie Goreng Jawa",
        description: "Mie goreng khas Jawa dengan bumbu rempah pilihan",
        price: 30000,
        categoryId: makanan.id,
      },
      {
        name: "Ayam Bakar Madu",
        description: "Ayam bakar dengan olesan madu dan bumbu kecap",
        price: 45000,
        categoryId: makanan.id,
      },
      {
        name: "Soto Ayam",
        description: "Soto ayam kuah bening dengan nasi dan pelengkap",
        price: 28000,
        categoryId: makanan.id,
      },
      {
        name: "Es Teh Manis",
        description: "Teh manis segar dengan es batu",
        price: 8000,
        categoryId: minuman.id,
      },
      {
        name: "Jus Alpukat",
        description: "Jus alpukat segar dengan susu coklat",
        price: 18000,
        categoryId: minuman.id,
      },
      {
        name: "Es Jeruk",
        description: "Jeruk peras segar dengan es",
        price: 10000,
        categoryId: minuman.id,
      },
      {
        name: "Tahu Crispy",
        description: "Tahu goreng renyah dengan saus sambal",
        price: 15000,
        categoryId: snack.id,
      },
      {
        name: "Kentang Goreng",
        description: "Kentang goreng renyah dengan saus mayo",
        price: 20000,
        categoryId: snack.id,
      },
      {
        name: "Pisang Goreng Keju",
        description: "Pisang goreng crispy tabur keju dan susu kental",
        price: 18000,
        categoryId: dessert.id,
      },
      {
        name: "Es Cendol",
        description: "Cendol segar dengan santan dan gula merah",
        price: 12000,
        categoryId: dessert.id,
      },
      {
        name: "Puding Coklat",
        description: "Puding coklat lembut dengan vla vanilla",
        price: 15000,
        categoryId: dessert.id,
      },
    ],
  });

  // Admin User (password: admin123)
  const passwordHash = await Bun.password.hash("admin123", {
    algorithm: "bcrypt",
    cost: 10,
  });

  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      name: "Administrator",
      role: "OWNER",
    },
  });

  // Tables (5 tables)
  for (let i = 1; i <= 5; i++) {
    await prisma.table.upsert({
      where: { number: i },
      update: {},
      create: {
        number: i,
        name: `Meja ${i}`,
      },
    });
  }

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
