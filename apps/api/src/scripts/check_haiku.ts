
import { prisma } from "../prisma";

async function checkHaiku() {
  const haiku = await prisma.model.findFirst({
    where: { openrouterId: { contains: "haiku" } }
  });
  console.log("Haiku DB Entry:", JSON.stringify(haiku, null, 2));
}

checkHaiku();
