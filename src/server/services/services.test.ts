import { describe, expect, it } from 'vitest';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import { findAssessmentTest } from '@/domain/assessment';
import { isRegisteredFormula } from '@/domain/formulas';
import { measurementIssues } from '@/domain/measurement';
import { prescriptionIssues } from '@/domain/training/prescription';
import { type ClientContext, type TrainerContext } from '../context';
import { createDemoRepositories } from '../repositories/demo';
import { buildDemoDataset, DEMO_CLIENT_ID, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { getClientHome, getClientProgress, getClientSession, getClientWeek } from './client';
import {
  getClientOverview,
  getLoadOverview,
  getPlanningOverview,
  getTrainerDashboard,
  listTrainerClients,
} from './trainer';

const TODAY = '2026-11-04'; // miércoles
const data = buildDemoDataset(TODAY);
const repos = createDemoRepositories(data);

const trainerCtx = (trainerId = DEMO_TRAINER_ID): TrainerContext => ({
  actor: { role: 'trainer', trainerId } satisfies TrainerActor,
  today: TODAY,
  repos,
});
const clientCtx = (clientId = DEMO_CLIENT_ID): ClientContext => ({
  actor: { role: 'client', clientId, trainerId: DEMO_TRAINER_ID } satisfies ClientActor,
  today: TODAY,
  repos,
});

describe('integridad de los datos de demostración', () => {
  it('todas las prescripciones son válidas y usan ejercicios existentes', () => {
    const exerciseIds = new Set(data.exercises.map((e) => e.id));
    for (const session of data.sessions) {
      for (const rx of session.exercises) {
        expect(prescriptionIssues(rx), rx.id).toEqual([]);
        expect(exerciseIds.has(rx.exerciseId), rx.exerciseId).toBe(true);
      }
    }
  });

  it('todas las mediciones tienen una procedencia completa y pruebas del catálogo', () => {
    for (const result of data.assessments) {
      expect(measurementIssues(result.measurement, isRegisteredFormula), result.id).toEqual([]);
      expect(findAssessmentTest(result.testId), result.testId).toBeDefined();
    }
  });

  it('los registros corresponden a sesiones pasadas del mismo cliente', () => {
    const sessions = new Map(data.sessions.map((s) => [s.id, s]));
    for (const log of data.logs) {
      const session = sessions.get(log.sessionId);
      expect(session?.clientId).toBe(log.clientId);
      expect(log.date < TODAY).toBe(true);
    }
  });

  it('los repositorios devuelven copias: modificar el resultado no altera los datos', async () => {
    const client = await repos.clients.getById(DEMO_CLIENT_ID);
    client!.displayName = 'Modificado';
    expect((await repos.clients.getById(DEMO_CLIENT_ID))!.displayName).toBe('Marta Ríos');
  });
});

describe('experiencia del cliente', () => {
  it('la pantalla principal muestra la sesión de hoy', async () => {
    const home = await getClientHome(clientCtx());
    expect(home.firstName).toBe('Marta');
    expect(home.todaySession?.date).toBe(TODAY);
    expect(home.todaySession?.status).toBe('pending');
    expect(home.todaySession?.preview.length).toBeGreaterThan(0);
  });

  it('abre sus propias sesiones con toda la prescripción', async () => {
    const home = await getClientHome(clientCtx());
    const session = await getClientSession(clientCtx(), home.todaySession!.id);
    expect(session?.exercises[0]).toMatchObject({
      name: 'Sentadilla trasera con barra',
      setsAndReps: '4 × 6–8',
    });
    expect(session?.exercises[0]?.tempo?.code).toBe('3-1-X-0');
    expect(session?.exercises.map((e) => e.slot)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('no puede abrir la sesión de otro cliente (se trata como inexistente)', async () => {
    const foreign = data.sessions.find((s) => s.clientId !== DEMO_CLIENT_ID)!;
    expect(await getClientSession(clientCtx(), foreign.id)).toBeNull();
    expect(await getClientSession(clientCtx(), 'no-existe')).toBeNull();
  });

  it('la semana tiene siete días y contiene la sesión de hoy', async () => {
    const week = await getClientWeek(clientCtx());
    expect(week.days).toHaveLength(7);
    expect(week.days.find((d) => d.date === TODAY)?.sessions).toHaveLength(1);
  });

  it('el progreso solo incluye lo compartido por el entrenador', async () => {
    const progress = await getClientProgress(clientCtx());
    expect(progress.volume).not.toBeNull();
    expect(progress.assessments?.map((s) => s.testId).sort()).toEqual(['cmj', 'sprint-20']);
  });

  it('a un cliente sin nada compartido no le llega ningún dato de progreso', async () => {
    const progress = await getClientProgress(clientCtx('c-nerea'));
    expect(progress).toEqual({ volume: null, assessments: null });
  });
});

describe('experiencia del entrenador', () => {
  it('ve a todos sus clientes, con los activos primero', async () => {
    const clients = await listTrainerClients(trainerCtx());
    expect(clients).toHaveLength(5);
    expect(clients.at(-1)?.status).toBe('paused');
  });

  it('otro entrenador no ve ni puede abrir los clientes ajenos', async () => {
    expect(await listTrainerClients(trainerCtx('t-otro'))).toEqual([]);
    expect(await getClientOverview(trainerCtx('t-otro'), DEMO_CLIENT_ID)).toBeNull();
  });

  it('el panel cuenta las sesiones de hoy y de la semana', async () => {
    const dashboard = await getTrainerDashboard(trainerCtx());
    expect(dashboard.activeClients).toBe(4);
    expect(dashboard.pausedClients).toBe(1);
    // Hoy (miércoles) entrenan Marta (días alternos desde hoy) y Diego (lunes, miércoles y viernes).
    expect(dashboard.todaySessions.map((s) => s.clientName).sort()).toEqual([
      'Diego Alonso',
      'Marta Ríos',
    ]);
    expect(dashboard.week.planned).toBeGreaterThanOrEqual(
      dashboard.week.completed + dashboard.week.missed,
    );
    expect(dashboard.activeRehabCases).toBe(1);
  });

  it('la ficha incluye datos de salud solo para el entrenador responsable', async () => {
    const overview = await getClientOverview(trainerCtx(), 'c-diego');
    expect(overview?.rehab?.phases.map((p) => p.state)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('la carga semanal cubre 4 semanas por cliente activo y declara sus fórmulas', async () => {
    const load = await getLoadOverview(trainerCtx());
    expect(load.clients).toHaveLength(4);
    for (const client of load.clients) expect(client.weeks).toHaveLength(4);
    expect(load.formulas.map((f) => f.id)).toContain('training.volume-load');
  });

  it('la planificación muestra la semana en curso', async () => {
    const planning = await getPlanningOverview(trainerCtx());
    expect(planning.days[0]).toBe('2026-11-02');
    expect(planning.clients.find((c) => c.id === DEMO_CLIENT_ID)?.sessions.length).toBeGreaterThan(
      0,
    );
  });
});
