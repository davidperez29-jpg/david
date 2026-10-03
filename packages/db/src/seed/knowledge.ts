import { join } from 'node:path';
import type { Database } from '../client';
import { loadAssessmentFiles, seedAssessment, type AssessmentSeedReport } from './assessment';
import { loadEvidenceFiles, seedEvidence, type EvidenceSeedReport } from './evidence';

/**
 * Loads the platform-wide knowledge base from `seed-data/`: verified evidence and methods, then
 * the assessment catalogue (whose sources are imported as evidence sources first).
 */
export async function seedKnowledgeBase(
  db: Database,
  seedDir: string,
): Promise<{ evidence: EvidenceSeedReport; assessment: AssessmentSeedReport }> {
  const evidenceData = loadEvidenceFiles(join(seedDir, 'evidence'));
  const assessmentData = loadAssessmentFiles(join(seedDir, 'assessment'));
  if (assessmentData.sources.length) {
    evidenceData.topics.push({
      topic: 'assessment',
      sources: assessmentData.sources,
      findings: [],
      claims: [],
    });
  }
  const evidence = await seedEvidence(db, evidenceData);
  const assessment = await seedAssessment(db, assessmentData);
  return { evidence, assessment };
}
