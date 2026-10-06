import { join } from 'node:path';
import type { Database } from '../client';
import { loadAssessmentFiles, seedAssessment, type AssessmentSeedReport } from './assessment';
import { loadEvidenceFiles, seedEvidence, type EvidenceSeedReport } from './evidence';
import { loadExerciseFile, seedGlobalExercises } from './exercises';
import { loadInjuryFile, seedInjuryCatalog } from './injury';
import { generateProfileTemplates } from './profile-templates';
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
  injury: { conditions: number; protocols: number };
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
  // Hand-written templates first; the generated ones fill the remaining profile × level × days.
  const handWritten = loadTemplateFiles(join(seedDir, 'templates'));
  const templates = await seedTemplates(db, [
    ...handWritten,
    ...generateProfileTemplates(handWritten),
  ]);
  // Injury protocols cite evidence sources and assessment tests (both seeded above).
  const injury = await seedInjuryCatalog(
    db,
    loadInjuryFile(join(seedDir, 'injury', 'protocols.json')),
  );
  return { evidence, assessment, exercises, templates, injury };
}
