import { describe, expect, it } from 'vitest';
import {
  canAccessClient,
  canReadResource,
  defaultSharing,
  visibleAssessmentTestIds,
  type Actor,
  type SharingSettings,
} from './access';

const marta = { id: 'c-marta', trainerId: 't-alex' };
const otherClient = { id: 'c-otro', trainerId: 't-alex' };
const foreignClient = { id: 'c-ajeno', trainerId: 't-otro' };

const trainer: Actor = { role: 'trainer', trainerId: 't-alex' };
const otherTrainer: Actor = { role: 'trainer', trainerId: 't-otro' };
const martaActor: Actor = { role: 'client', clientId: 'c-marta', trainerId: 't-alex' };

const sharing: SharingSettings = {
  clientId: 'c-marta',
  assessments: { enabled: true, testIds: ['cmj'] },
  volume: true,
  rehab: false,
  reports: false,
};

describe('control de acceso', () => {
  it('un entrenador solo accede a sus propios clientes', () => {
    expect(canAccessClient(trainer, marta)).toBe(true);
    expect(canAccessClient(trainer, foreignClient)).toBe(false);
    expect(canAccessClient(otherTrainer, marta)).toBe(false);
  });

  it('un cliente solo accede a sí mismo', () => {
    expect(canAccessClient(martaActor, marta)).toBe(true);
    expect(canAccessClient(martaActor, otherClient)).toBe(false);
  });

  it('el cliente ve su plan y sus registros, pero nunca las notas privadas del entrenador', () => {
    expect(canReadResource(martaActor, marta, 'plan', null)).toBe(true);
    expect(canReadResource(martaActor, marta, 'own_logs', null)).toBe(true);
    expect(canReadResource(martaActor, marta, 'trainer_notes', sharing)).toBe(false);
    expect(canReadResource(trainer, marta, 'trainer_notes', null)).toBe(true);
  });

  it('el resto de módulos solo se ven si el entrenador los comparte', () => {
    expect(canReadResource(martaActor, marta, 'volume', sharing)).toBe(true);
    expect(canReadResource(martaActor, marta, 'rehab', sharing)).toBe(false);
    expect(canReadResource(martaActor, marta, 'volume', defaultSharing('c-marta'))).toBe(false);
    expect(canReadResource(martaActor, marta, 'volume', null)).toBe(false);
  });

  it('ignora una configuración de compartición que pertenece a otro cliente', () => {
    const misplaced = { ...sharing, clientId: 'c-otro' };
    expect(canReadResource(martaActor, marta, 'volume', misplaced)).toBe(false);
  });

  it('limita las evaluaciones visibles a las pruebas compartidas', () => {
    expect(visibleAssessmentTestIds(trainer, marta, null)).toBe('all');
    expect([...(visibleAssessmentTestIds(martaActor, marta, sharing) as Set<string>)]).toEqual([
      'cmj',
    ]);
    expect((visibleAssessmentTestIds(martaActor, otherClient, sharing) as Set<string>).size).toBe(
      0,
    );
  });
});
