// Server-side keyword classification fallback
export interface ClassificationResult {
  label: 'commitment' | 'writeup' | null;
  confidence: number;
}

const WRITEUP_KEYWORDS = [
  'write up', 'write-up', 'incident', 'violation', 'warning', 
  'policy', 'consequence', 'disciplinary', 'infraction', 'offense'
];

const COMMITMENT_KEYWORDS = [
  'commitment', 'goal', 'plan', 'amends', 'step', 'sponsor', 
  'mentor', 'aa', 'na', 'meeting', 'pledge', 'promise', 'dedication'
];

export function classifyDocumentByKeywords(text: string): ClassificationResult {
  const normalizedText = text.toLowerCase();
  
  let writeupScore = 0;
  let commitmentScore = 0;
  
  // Count keyword matches
  WRITEUP_KEYWORDS.forEach(keyword => {
    if (normalizedText.includes(keyword)) {
      writeupScore++;
    }
  });
  
  COMMITMENT_KEYWORDS.forEach(keyword => {
    if (normalizedText.includes(keyword)) {
      commitmentScore++;
    }
  });
  
  // If no keywords found, return null
  if (writeupScore === 0 && commitmentScore === 0) {
    return { label: null, confidence: 0 };
  }
  
  // Determine classification
  const totalScore = writeupScore + commitmentScore;
  const maxScore = Math.max(writeupScore, commitmentScore);
  
  const label = writeupScore > commitmentScore ? 'writeup' : 'commitment';
  const confidence = maxScore / totalScore;
  
  return { label, confidence };
}