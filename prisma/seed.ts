import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const subjects = [
  {
    key: "chemistry",
    nameAr: "الكيمياء - سادس إعدادي",
    nameEn: "Chemistry - 6th Prep",
    description: "الفصل السادس: الهيدروكربونات (الميثان والإيثيلين وما إليها).",
  },
  {
    key: "math",
    nameAr: "الرياضيات - سادس إعدادي",
    nameEn: "Math - 6th Prep",
    description: "ترتيب العمليات الحسابية والتطبيقات (Mappings).",
  },
  {
    key: "english",
    nameAr: "اللغة الإنكليزية - سادس إعدادي",
    nameEn: "English - 6th Prep",
    description: "منهج اللغة الإنكليزية للمرحلة الإعدادية.",
  },
];

async function main() {
  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { key: subject.key },
      update: subject,
      create: subject,
    });
  }
  console.log(`Seeded ${subjects.length} subjects.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
