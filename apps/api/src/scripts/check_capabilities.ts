import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '../../../../.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const models = await prisma.model.findMany({
    where: { isActive: true },
    select: { architecture: true, openrouterId: true, name: true }
  });

  let webSearch = 0, reasoning = 0, audio = 0, imageOutput = 0;
  const webSearchModels: string[] = [];
  const reasoningModels: string[] = [];
  const audioModels: string[] = [];
  const imageOutputModels: string[] = [];

  for (const m of models) {
    const arch = m.architecture as any || {};
    if (arch.has_web_search) {
      webSearch++;
      webSearchModels.push(m.openrouterId);
    }
    if (arch.is_reasoning) {
      reasoning++;
      reasoningModels.push(m.openrouterId);
    }
    if (arch.has_audio) {
      audio++;
      audioModels.push(m.openrouterId);
    }
    if (arch.output_modalities?.includes('image')) {
      imageOutput++;
      imageOutputModels.push(m.openrouterId);
    }
  }

  console.log('\n████████████████████████████████████████████████████████████████████████████████');
  console.log('  ZEROPROMPT CAPABILITIES SUMMARY');
  console.log('████████████████████████████████████████████████████████████████████████████████\n');

  console.log(`📊 Total Active Models: ${models.length}\n`);

  console.log(`🌐 WEB SEARCH (Native): ${webSearch} models`);
  if (webSearchModels.length > 0) {
    console.log('   Models with native web search:');
    webSearchModels.slice(0, 10).forEach(m => console.log(`   - ${m}`));
    if (webSearchModels.length > 10) console.log(`   ... and ${webSearchModels.length - 10} more`);
  }

  console.log(`\n🧠 REASONING (Thinking): ${reasoning} models`);
  if (reasoningModels.length > 0) {
    console.log('   Models with reasoning:');
    reasoningModels.slice(0, 10).forEach(m => console.log(`   - ${m}`));
    if (reasoningModels.length > 10) console.log(`   ... and ${reasoningModels.length - 10} more`);
  }

  console.log(`\n🎤 AUDIO: ${audio} models`);
  if (audioModels.length > 0) {
    console.log('   Models with audio:');
    audioModels.forEach(m => console.log(`   - ${m}`));
  }

  console.log(`\n🖼️ IMAGE OUTPUT: ${imageOutput} models`);
  if (imageOutputModels.length > 0) {
    console.log('   Models that can generate images:');
    imageOutputModels.forEach(m => console.log(`   - ${m}`));
  }

  console.log('\n████████████████████████████████████████████████████████████████████████████████');
  console.log('  CAPABILITY STATUS');
  console.log('████████████████████████████████████████████████████████████████████████████████\n');

  console.log(`✅ Web Search: ${webSearch > 0 ? 'AVAILABLE' : 'NOT AVAILABLE'} (${webSearch} native + ALL via Exa plugin)`);
  console.log(`✅ Reasoning: ${reasoning > 0 ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
  console.log(`${audio > 0 ? '✅' : '⚠️'} Audio: ${audio > 0 ? 'AVAILABLE' : 'NO MODELS'}`);
  console.log(`${imageOutput > 0 ? '✅' : '⚠️'} Image Generation: ${imageOutput > 0 ? 'AVAILABLE' : 'NO MODELS DETECTED'}`);

  console.log('\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
