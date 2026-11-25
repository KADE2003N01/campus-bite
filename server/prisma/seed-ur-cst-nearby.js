import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const coverPhoto = (photoId) => `https://images.unsplash.com/photo-${photoId}?w=1200&q=75&auto=format&fit=crop`;

// Public directory records to help populate the UR-CST prototype. These are
// unclaimed, non-orderable listings; menus, prices, ratings, and hours are not
// invented. The owner accounts have random passwords and cannot be used to log in.
const places = [
  {
    slug: "ur-cst-student-restaurant",
    name: "UR-CST Student Restaurant",
    cuisine: "Campus dining",
    location: "Student Restaurant, UR-CST Nyarugenge Campus (KN 7 Avenue)",
    phone: "Not publicly listed",
    photo: "1504674900247-0877df9cc836",
    details: "The UR-CST campus map marks a restaurant on the Nyarugenge campus. Its current menu, prices, hours, and contact details are not listed here.",
  },
  {
    slug: "ur-cst-cantine-1",
    name: "UR-CST Cantine 1",
    cuisine: "Campus canteen",
    location: "Security Office 1, UR-CST Nyarugenge Campus",
    phone: "Not publicly listed",
    photo: "1512058564366-18510be2db19",
    details: "Cantine 1 is named on the official UR-CST Nyarugenge campus map. Its current menu, prices, hours, and contact details are not listed here.",
  },
  {
    slug: "ur-cst-cantine-2",
    name: "UR-CST Cantine 2",
    cuisine: "Campus canteen",
    location: "Building 32, UR-CST Nyarugenge Campus",
    phone: "Not publicly listed",
    photo: "1603133872878-684f208fb84b",
    details: "Cantine 2 is named on the official UR-CST Nyarugenge campus map. Its current menu, prices, hours, and contact details are not listed here.",
  },
  {
    slug: "muhabura-cantine",
    name: "Muhabura Cantine",
    cuisine: "Canteen",
    location: "Muhabura area, about 442 m from KN 7 Avenue, Nyarugenge Campus",
    phone: "Not publicly listed",
    photo: "1532550907401-a500c9a57435",
    details: "Listed near KN 7 Avenue in a public OpenStreetMap-based directory. Current venue details have not been confirmed by the operator.",
  },
  {
    slug: "dusaidi-hostel-canteen",
    name: "Dusaidi Hostel Canteen",
    cuisine: "Canteen",
    location: "Ground floor, Dusaidi Students Hostel, UR-CST Nyarugenge Campus",
    phone: "Not publicly listed",
    photo: "1490645935967-10de6ba17061",
    details: "A canteen is noted at the Dusaidi hostel in a public OpenStreetMap-based directory. Current venue details have not been confirmed by the operator.",
  },
  {
    slug: "ikaze-canteen",
    name: "Ikaze Canteen",
    cuisine: "Canteen",
    location: "Ikaze Block / KN 73 Street, about 648 m from KN 7 Avenue",
    phone: "Not publicly listed",
    photo: "1555939594-58d7cb561ad1",
    details: "Listed near KN 7 Avenue in a public OpenStreetMap-based directory. Current venue details have not been confirmed by the operator.",
  },
  {
    slug: "tamu-tamu-restaurant",
    name: "Tamu Tamu Restaurant",
    cuisine: "Rwandan and East African",
    location: "KN 2 Avenue, Nyarugenge, Kigali",
    phone: "Not publicly listed",
    photo: "1512621776951-a57141f2eefd",
    details: "Public listings describe a Kigali restaurant and mention local dishes including chapati, pilau, chicken, and tilapia. Menu and prices need confirmation with the venue.",
  },
  {
    slug: "al-mann-ran-coffee-house",
    name: "Al Mann & RaN Coffee House",
    cuisine: "Coffee and meals",
    location: "KN 119 Street, Nyarugenge, Kigali",
    phone: "+250788437728",
    photo: "1509042239860-f550ce710b93",
    details: "The venue's website describes a coffee house with a food menu at KN 119 Street. Current menu, prices, and opening hours should be confirmed with the venue.",
  },
  {
    slug: "macoco-restaurant",
    name: "Macoco Restaurant",
    cuisine: "Rwandan and African",
    location: "Biryogo Free Zone, Nyarugenge, Kigali",
    phone: "Not publicly listed",
    photo: "1626082927389-6cd097cdc6ec",
    details: "Public listings place Macoco in the Biryogo Free Zone and describe African meals. Current menu, prices, hours, and contact details should be confirmed with the venue.",
  },
];

async function main() {
  const inaccessiblePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  for (const place of places) {
    const email = `directory+${place.slug}@campusbite.test`;
    const owner = await prisma.user.upsert({
      where: { email },
      create: {
        name: "CampusBite unclaimed directory listing",
        email,
        password_hash: inaccessiblePassword,
        role: "VENDOR",
      },
      update: { name: "CampusBite unclaimed directory listing", role: "VENDOR" },
    });

    const description = `${place.details} Directory/demo entry only: this venue has not joined CampusBite. Cover photo is representative and may not show this venue. Ordering is disabled until the venue details are verified and an authorized vendor account is configured.`;
    const data = {
      shop_name: place.name,
      cuisine: place.cuisine,
      description,
      location: place.location,
      phone: place.phone,
      cover_url: coverPhoto(place.photo),
    };

    await prisma.vendor.upsert({
      where: { user_id: owner.id },
      create: {
        user_id: owner.id,
        ...data,
        is_open: false,
        rating_avg: 0,
        rating_count: 0,
      },
      update: data,
    });
  }

  console.log(`Seeded ${places.length} unclaimed UR-CST-area directory listings. No menu, review, rating, or order data was invented.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
