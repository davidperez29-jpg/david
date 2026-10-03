import { join } from 'node:path';
import type { Database } from '../client';
import { loadAssessmentFiles, seedAssessment, type AssessmentSeedReport } from './assessment';
import { loadEvidenceFiles, seedEvidence, type EvidenceSeedReport } from './evidence';
import { loadExerciseFile, seedGlobalExercises } from './exercises';
import { loadTemplateFiles, seedTemplates } from './templates';

/**
 * Loads the platform-wide knowledge base from `seed-data/`: verified evidence and methods, then
 * the assessment catalogue (whose sources are imported as evidence sources first).
 */
export async function seedKnowledgeBase(
  db: Database,
  seedDir: string,
): Promise<{
  evidence: EvidenceSeedReport;
  assessment: AssessmentSeedReport;
  exercises: { exercises: number; progressions: number };
  templates: { templates: number };
}> {
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
  // Global exercises link to methods (science layer) and templates reference both.
  const exercises = await seedGlobalExercises(
    db,
    loadExerciseFile(join(seedDir, 'exercises', 'global.json')),
  );
  const templates = await seedTemplates(db, loadTemplateFiles(join(seedDir, 'templates')));
  return { evidence, assessment, exercises, templates };
}
