
import { prisma } from "../prisma";

async function checkHaiku35() {
  const haiku = await prisma.model.findUnique({
    where: { openrouterId: "anthropic/claude-3.5-haiku" }
  });
  console.log("Haiku 3.5 DB Entry:", JSON.stringify(haiku, null, 2));
}

checkHaiku35();
