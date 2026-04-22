import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface RawProfile {
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
}

async function main() {
  const filePath = path.join(__dirname, "data", "profiles.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Seed file not found at ${filePath}.\nPlease place your profiles.json inside prisma/data/`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const profiles: RawProfile[] = Array.isArray(parsed) ? parsed : parsed.profiles;

  if (!Array.isArray(profiles)) {
    throw new Error('Invalid seed file format. Expected an array or { "profiles": [...] }');
  }

  console.log(`Seeding ${profiles.length} profiles...`);

  // Fetch all existing names in one query
  const existing = await prisma.profile.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((p) => p.name));

  // Filter to only new profiles
  const newProfiles = profiles.filter((p) => !existingNames.has(p.name));

  console.log(`Found ${existingNames.size} existing, inserting ${newProfiles.length} new...`);

  if (newProfiles.length === 0) {
    console.log("✅ Nothing to insert. All profiles already exist.");
    return;
  }

  // Bulk insert in one operation
  await prisma.profile.createMany({
    data: newProfiles.map((profile) => ({
      id: uuidv7(),
      name: profile.name,
      gender: profile.gender,
      gender_probability: profile.gender_probability,
      age: profile.age,
      age_group: profile.age_group,
      country_id: profile.country_id,
      country_name: profile.country_name,
      country_probability: profile.country_probability,
    })),
    skipDuplicates: true,
  });

  console.log(`✅ Seeding complete.`);
  console.log(`   Inserted : ${newProfiles.length}`);
  console.log(`   Skipped  : ${existingNames.size}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });