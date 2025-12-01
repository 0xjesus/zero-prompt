import { Router } from "express";
import { prisma } from "../prisma";

export const promptRouter = Router();

promptRouter.get("/", async (_req, res) => {
  const prompts = await prisma.prompt.findMany({
    orderBy: { createdAt: "desc" },
    take: 20
  });

  res.json({ prompts });
});

promptRouter.post("/", async (req, res) => {
  const { title, body } = req.body || {};

  if (!title || !body) {
    return res.status(400).json({ error: "title_and_body_required" });
  }

  const prompt = await prisma.prompt.create({
    data: {
      title,
      body
    }
  });

  res.status(201).json({ prompt });
});
