import { runAIInvestigation } from './ai-investigation';

async function main() {
  console.log('🚀 Initiating GPT-5 powered investigation of HouseGuide...\n');
  console.log('════════════════════════════════════════════════════════');
  
  try {
    const report = await runAIInvestigation();
    
    console.log('\n📊 INVESTIGATION COMPLETE - FULL REPORT:\n');
    console.log('════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(report, null, 2));
    
    // Save report to file
    const fs = await import('fs/promises');
    await fs.writeFile('investigation-report.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Report saved to investigation-report.json');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

main();