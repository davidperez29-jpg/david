"""
Generates seed-data/templates/templates.json (MASTER_SPECIFICATION §12.3).
Starting points, not recipes. Doses come from the global methods' variables (seed-data/evidence/
methods.json): hypertrophy rest ≥ 60–90 s and sets close to failure (RIR); strength ≥ 80 % 1RM;
older adults 2–3 × 7–9; power 30–70 % 1RM; plyometrics and sprint by method. Everything else
(exact exercise selection, RIR waves, deload) is practical guidance (level F), editable.
Run: python3 seed-data/templates/_build.py
"""
import json, os

def rx(sets=None, reps=None, rir=None, rest=None, pct=None, dur=None, dist=None, contacts=None, vl=None):
    p = {}
    if sets: p['sets'] = sets
    if reps: p['repsMin'], p['repsMax'] = (reps, reps) if isinstance(reps, int) else reps
    if rir is not None: p['rirMin'], p['rirMax'] = (rir, rir) if isinstance(rir, int) else rir
    if rest is not None: p['restS'] = rest
    if pct: p['loadPct1rm'] = pct
    if dur: p['durationS'] = dur
    if dist: p['distanceM'] = dist
    if contacts: p['contacts'] = contacts
    if vl: p['velocityLossPct'] = vl
    return p

WAVE = {'kind': 'rir_wave', 'step': 1, 'floor': 1}
LIN_PCT = {'kind': 'linear_load', 'incrementPct': 2.5, 'capPct': 90}

def ex(slug, p, methods=(), prog=None, basis=None, pair=None, side=None):
    e = {'exercise': slug, 'prescription': p}
    if methods: e['methods'] = list(methods)
    if prog: e['progression'] = prog
    if basis: e['loadBasisMetric'] = basis
    if pair: e['pairingLabel'] = pair
    if side: e['side'] = side
    return e

def block(type_, exercises, label=None, org='straight_sets', rounds=None):
    b = {'type': type_, 'organization': org, 'exercises': exercises}
    if label: b['label'] = label
    if rounds: b['rounds'] = rounds
    return b

WARM = block('warm_up', [ex('worlds_greatest_stretch', rx(1, 5)), ex('cat_camel', rx(1, 8)), ex('miniband_glute_activation', rx(1, 10))], 'Calentamiento')
WARM_ATH = block('warm_up', [ex('worlds_greatest_stretch', rx(1, 5)), ex('ankle_knee_to_wall', rx(1, 8)), ex('pogo_jumps', rx(2, contacts=10), ['pliometria'])], 'Calentamiento')

def session(label, title, blocks, objective=None, minutes=60):
    s = {'dayLabel': label, 'title': title, 'durationMin': minutes, 'blocks': blocks}
    if objective: s['objective'] = objective
    return s

# ── Hypertrophy (method «hipertrofia»: rest ≥ 60–90 s; series close to failure, not to failure) ──
H = ['hipertrofia']
def hyp(slug, sets=3, reps=(8, 12), rest=120, pair=None):
    return ex(slug, rx(sets, reps, (2, 3), rest), H, WAVE, pair=pair)
FB_A = [hyp('back_squat'), hyp('dumbbell_bench_press'), hyp('seated_cable_row'), hyp('romanian_deadlift'), hyp('lateral_raise', 2, (10, 15), 90)]
FB_B = [hyp('leg_press'), hyp('lat_pulldown'), hyp('incline_dumbbell_press'), hyp('hip_thrust'), hyp('biceps_curl', 2, (10, 15), 90, 'A1'), hyp('triceps_pushdown', 2, (10, 15), 90, 'A2')]
FB_C = [hyp('bulgarian_split_squat'), hyp('one_arm_dumbbell_row'), hyp('dumbbell_shoulder_press'), hyp('leg_curl_machine'), hyp('standing_calf_raise', 3, (10, 15), 90)]
UPPER_A = [hyp('bench_press', 4), hyp('barbell_row', 4), hyp('dumbbell_shoulder_press'), hyp('lat_pulldown'), hyp('biceps_curl', 2, (10, 15), 90)]
LOWER_A = [hyp('back_squat', 4), hyp('romanian_deadlift'), hyp('walking_lunge'), hyp('leg_curl_machine'), hyp('standing_calf_raise', 3, (10, 15), 90)]
UPPER_B = [hyp('incline_dumbbell_press', 4), hyp('seated_cable_row', 4), hyp('lateral_raise', 3, (12, 15), 90), hyp('face_pull', 2, (12, 15), 90), hyp('triceps_pushdown', 2, (10, 15), 90)]
LOWER_B = [hyp('leg_press', 4), hyp('hip_thrust'), hyp('bulgarian_split_squat'), hyp('leg_extension', 2, (12, 15), 90), hyp('seated_calf_raise', 3, (10, 15), 90)]
CORE_HYP = block('core', [ex('dead_bug', rx(2, 8)), ex('side_plank', rx(2, dur=30))], 'Core')

def hs(label, title, exs, minutes=60):
    return session(label, title, [WARM, block('hypertrophy', exs, 'Principal'), CORE_HYP], 'Hipertrofia: volumen semanal suficiente cerca del fallo', minutes)

# ── Strength (method «fuerza-maxima»: ≥ 80 % 1RM; repartir volumen en más sesiones) ──
S = ['fuerza-maxima']
def heavy(slug, basis, sets=3, reps=(3, 5)):
    return ex(slug, rx(sets, reps, (1, 2), 180, 80), S, LIN_PCT, basis)
def acc(slug, sets=3, reps=(6, 10)):
    return ex(slug, rx(sets, reps, (2, 3), 120), H, WAVE)
SQ, BP, DL = 'one_rm_back_squat', 'one_rm_bench_press', 'one_rm_deadlift'

def ss(label, title, main, accessories, minutes=70):
    return session(label, title, [WARM, block('main_strength', main, 'Básicos'), block('hypertrophy', accessories, 'Accesorios'), CORE_HYP], 'Fuerza máxima con cargas altas y técnica estable', minutes)

# ── Health / older adults (method «fuerza-mayores»: 2–3 × 7–9; potencia moderada) ──
O = ['fuerza-mayores']
def health(slug, sets=2, reps=(7, 9), rest=90):
    return ex(slug, rx(sets, reps, (2, 3), rest), O)
BAL = block('activation', [ex('single_leg_balance', rx(2, dur=30), side='each'), ex('tandem_walk', rx(2, dur=30))], 'Equilibrio')
def hss(label, title, exs, cond=None, minutes=50):
    blocks = [WARM, BAL, block('main_strength', exs, 'Fuerza y función')]
    if cond: blocks.append(cond)
    return session(label, title, blocks, 'Fuerza, función y equilibrio', minutes)
WALK = block('conditioning', [ex('brisk_walking', rx(dur=900))], 'Aeróbico')

# ── Team sport (methods: fuerza, potencia, pliometría, sprint, COD) ──
P = ['pliometria']
PW = ['potencia']
SP = ['sprint-aceleracion']
CD = ['cod-agilidad']
PLYO = block('plyometric', [ex('countermovement_jump', rx(3, 5, rest=90), P), ex('lateral_bounds', rx(3, 6, rest=90), P)], 'Pliometría')
SPRINT = block('sprint_cod', [ex('acceleration_10m', rx(5, dist=10, rest=120), SP), ex('sprint_20m', rx(3, dist=20, rest=180), SP)], 'Velocidad')
COD = block('sprint_cod', [ex('deceleration_drill', rx(4, dist=10, rest=90), CD), ex('drill_505', rx(4, rest=120), CD)], 'Cambio de dirección')
POWER = block('power_potentiation', [ex('jump_squat_loaded', rx(3, 5, rest=150, pct=40, vl=20), PW + ['vbt-perdida-velocidad'], basis=SQ), ex('med_ball_rotational_throw', rx(3, 5, rest=90), PW, side='each')], 'Potencia')
PREV = block('core', [ex('nordic_hamstring_curl', rx(2, (3, 5), rest=120), ['nordic-hamstring']), ex('copenhagen_plank', rx(2, dur=20), ['calentamiento-preventivo'], side='each')], 'Fuerza complementaria')
def ts(label, title, blocks, minutes=75):
    return session(label, title, [WARM_ATH] + blocks, 'Rendimiento en deporte de equipo', minutes)

# ── Endurance athletes (method «concurrente»: fuerza pesada y pliometría para la economía) ──
E = ['concurrente']
def es(label, title, blocks, minutes=50):
    return session(label, title, [WARM_ATH] + blocks, 'Fuerza para deportistas de resistencia', minutes)

# ── Initiation (technique of patterns; method «dosis-minima» y «hipertrofia») ──
I = ['dosis-minima']
def ini(slug, sets=2, reps=(10, 12)):
    return ex(slug, rx(sets, reps, (3, 4), 90), I)

def phases(spw_note=''):
    return [
        {'name': 'Base', 'objective': 'Familiarización y técnica; volumen moderado', 'mesocycles': [
            {'name': 'Mesociclo 1', 'weeks': 4, 'focus': 'Técnica y adaptación', 'weekTypes': ['introduction', 'progression', 'progression', 'deload']}]},
        {'name': 'Desarrollo', 'objective': 'Progresión de la carga o del esfuerzo', 'mesocycles': [
            {'name': 'Mesociclo 2', 'weeks': 4, 'focus': 'Progresión', 'weekTypes': ['progression', 'progression', 'peak', 'deload']},
            {'name': 'Mesociclo 3', 'weeks': 4, 'focus': 'Consolidación y reevaluación', 'weekTypes': ['progression', 'progression', 'peak', 'test'], 'assessmentPlanned': True}]},
    ]

def tpl(slug, name, goal, level, methods, sessions, description):
    return {'slug': slug, 'name': name, 'goal': goal, 'level': level, 'methods': methods, 'description': description,
            'definition': {'durationMonths': 3, 'sessionsPerWeek': len(sessions), 'phases': phases(), 'sessions': sessions}}

NOTE = 'Punto de partida, no receta: ajusta ejercicios, dosis y semanas al cliente. Las dosis siguen las variables de los métodos enlazados; la ola de RIR y la descarga son recomendaciones prácticas (F).'
T = [
    tpl('hipertrofia-2d', 'Hipertrofia · 2 días (full body)', 'hypertrophy', 'beginner', H, [hs('A', 'Full body A', FB_A), hs('B', 'Full body B', FB_B)], NOTE),
    tpl('hipertrofia-3d', 'Hipertrofia · 3 días (full body)', 'hypertrophy', 'intermediate', H, [hs('A', 'Full body A', FB_A), hs('B', 'Full body B', FB_B), hs('C', 'Full body C', FB_C)], NOTE),
    tpl('hipertrofia-4d', 'Hipertrofia · 4 días (torso/pierna)', 'hypertrophy', 'intermediate', H, [hs('A', 'Torso A', UPPER_A), hs('B', 'Pierna A', LOWER_A), hs('C', 'Torso B', UPPER_B), hs('D', 'Pierna B', LOWER_B)], NOTE),
    tpl('hipertrofia-5d', 'Hipertrofia · 5 días (torso/pierna + full body)', 'hypertrophy', 'advanced', H, [hs('A', 'Torso A', UPPER_A), hs('B', 'Pierna A', LOWER_A), hs('C', 'Full body', FB_C), hs('D', 'Torso B', UPPER_B), hs('E', 'Pierna B', LOWER_B)], NOTE),
    tpl('fuerza-2d', 'Fuerza · 2 días (2 básicos por sesión)', 'max_strength', 'intermediate', S + H,
        [ss('A', 'Sentadilla y press de banca', [heavy('back_squat', SQ), heavy('bench_press', BP)], [acc('one_arm_dumbbell_row'), acc('hip_thrust')]),
         ss('B', 'Peso muerto y press vertical', [heavy('deadlift', DL), heavy('overhead_press', None, 3, (4, 6))], [acc('pull_up', 3, (5, 8)), acc('split_squat')])], NOTE),
    tpl('fuerza-3d', 'Fuerza · 3 días (A/B/C con énfasis rotatorio)', 'max_strength', 'intermediate', S + H,
        [ss('A', 'Énfasis sentadilla', [heavy('back_squat', SQ), heavy('bench_press', BP, 3, (5, 6))], [acc('barbell_row'), acc('leg_curl_machine')]),
         ss('B', 'Énfasis peso muerto', [heavy('deadlift', DL), heavy('overhead_press', None, 3, (4, 6))], [acc('lat_pulldown'), acc('bulgarian_split_squat')]),
         ss('C', 'Énfasis press de banca', [heavy('bench_press', BP), heavy('front_squat', SQ, 3, (4, 6))], [acc('seated_cable_row'), acc('hip_thrust')])], NOTE),
    tpl('fuerza-4d', 'Fuerza · 4 días (torso/pierna pesado/ligero)', 'max_strength', 'advanced', S + H,
        [ss('A', 'Pierna pesado', [heavy('back_squat', SQ, 4), heavy('romanian_deadlift', None, 3, (5, 6))], [acc('walking_lunge'), acc('standing_calf_raise', 3, (8, 12))]),
         ss('B', 'Torso pesado', [heavy('bench_press', BP, 4), heavy('barbell_row', None, 4, (4, 6))], [acc('pull_up', 3, (5, 8)), acc('dumbbell_shoulder_press')]),
         ss('C', 'Pierna ligero', [heavy('deadlift', DL, 3, (2, 4))], [acc('leg_press', 3, (8, 10)), acc('hip_thrust'), acc('leg_curl_machine')]),
         ss('D', 'Torso ligero', [heavy('overhead_press', None, 4, (4, 6))], [acc('incline_dumbbell_press', 3, (8, 10)), acc('seated_cable_row', 3, (8, 10)), acc('face_pull', 2, (12, 15))])], NOTE),
    tpl('salud-2d', 'Salud y función · 2 días (full body)', 'general_health', 'beginner', O,
        [hss('A', 'Full body A', [health('sit_to_stand'), health('dumbbell_bench_press'), health('seated_cable_row'), health('step_up_low'), health('farmer_carry', 2, None)], WALK),
         hss('B', 'Full body B', [health('goblet_squat'), health('lat_pulldown'), health('glute_bridge'), health('incline_push_up'), health('pallof_press')], WALK)], NOTE),
    tpl('salud-3d', 'Salud y función · 3 días (full body + acondicionamiento)', 'general_health', 'beginner', O,
        [hss('A', 'Full body A', [health('sit_to_stand'), health('dumbbell_bench_press'), health('seated_cable_row'), health('step_up_low')], WALK),
         hss('B', 'Full body B', [health('goblet_squat'), health('lat_pulldown'), health('glute_bridge'), health('incline_push_up')], block('conditioning', [ex('bike_erg_intervals', rx(dur=900))], 'Aeróbico')),
         hss('C', 'Full body C', [health('leg_press'), health('one_arm_dumbbell_row'), health('dumbbell_shoulder_press'), health('farmer_carry', 2, None)], WALK)], NOTE),
    tpl('salud-4d', 'Salud y función · 4 días (2 fuerza + 2 aeróbico/multicomponente)', 'general_health', 'beginner', O,
        [hss('A', 'Fuerza A', [health('sit_to_stand'), health('dumbbell_bench_press'), health('seated_cable_row'), health('step_up_low')]),
         session('B', 'Aeróbico y equilibrio', [WARM, BAL, WALK], 'Actividad aeróbica y equilibrio', 45),
         hss('C', 'Fuerza B', [health('goblet_squat'), health('lat_pulldown'), health('glute_bridge'), health('incline_push_up')]),
         session('D', 'Multicomponente', [WARM, block('conditioning', [ex('bike_erg_intervals', rx(dur=900)), ex('farmer_carry', rx(2, dist=20))], 'Multicomponente'), BAL], 'Acondicionamiento y equilibrio', 45)], NOTE),
    tpl('equipo-2d', 'Deporte de equipo · 2 días (fuerza + potencia, en temporada)', 'team_sport_performance', 'intermediate', S + PW + P + SP,
        [ts('A', 'Fuerza tren inferior + velocidad', [SPRINT, block('main_strength', [heavy('back_squat', SQ), heavy('romanian_deadlift', None, 3, (5, 6))], 'Fuerza'), PREV]),
         ts('B', 'Potencia + fuerza tren superior', [PLYO, POWER, block('main_strength', [heavy('bench_press', BP), acc('pull_up', 3, (5, 8))], 'Fuerza')])], NOTE),
    tpl('equipo-3d', 'Deporte de equipo · 3 días (fuerza / potencia / mixto)', 'team_sport_performance', 'intermediate', S + PW + P + SP + CD,
        [ts('A', 'Fuerza', [block('main_strength', [heavy('back_squat', SQ), heavy('bench_press', BP), acc('barbell_row')], 'Fuerza'), PREV]),
         ts('B', 'Potencia y velocidad', [SPRINT, PLYO, POWER]),
         ts('C', 'Mixto y cambio de dirección', [COD, block('main_strength', [heavy('deadlift', DL, 3, (3, 5)), acc('split_squat'), acc('pull_up', 3, (5, 8))], 'Fuerza')])], NOTE),
    tpl('equipo-4d', 'Deporte de equipo · 4 días (inferior/superior + velocidad/COD)', 'team_sport_performance', 'advanced', S + PW + P + SP + CD,
        [ts('A', 'Fuerza tren inferior', [block('main_strength', [heavy('back_squat', SQ), heavy('romanian_deadlift', None, 3, (5, 6)), acc('split_squat')], 'Fuerza'), PREV]),
         ts('B', 'Velocidad', [SPRINT, PLYO]),
         ts('C', 'Fuerza tren superior y potencia', [POWER, block('main_strength', [heavy('bench_press', BP), acc('pull_up', 3, (5, 8)), acc('seated_cable_row')], 'Fuerza')]),
         ts('D', 'Cambio de dirección', [COD, block('plyometric', [ex('single_leg_hop', rx(3, 5, rest=90), P, side='each'), ex('box_jump', rx(3, 4, rest=90), P)], 'Pliometría')])], NOTE),
    tpl('resistencia-2d', 'Resistencia · 2 días de fuerza (full body)', 'endurance_sport_performance', 'intermediate', E + S + P,
        [es('A', 'Fuerza pesada', [block('main_strength', [ex('back_squat', rx(3, (4, 6), (2, 3), 180, 80), E + S, LIN_PCT, SQ), ex('romanian_deadlift', rx(3, (6, 8), (2, 3), 150), E), ex('step_up', rx(2, (8, 10), (2, 3), 90), E, side='each')], 'Fuerza'), block('core', [ex('front_plank', rx(2, dur=40)), ex('side_plank', rx(2, dur=30), side='each')], 'Core')]),
         es('B', 'Pliometría y fuerza', [block('plyometric', [ex('pogo_jumps', rx(3, contacts=15, rest=90), P), ex('single_leg_hop', rx(3, 5, rest=90), P, side='each')], 'Pliometría'), block('main_strength', [ex('deadlift', rx(3, (4, 6), (2, 3), 180, 80), E + S, LIN_PCT, DL), ex('standing_calf_raise', rx(3, (8, 12), (2, 3), 90), E)], 'Fuerza')])], NOTE),
    tpl('resistencia-3d', 'Resistencia · 2 fuerza + 1 pliometría/técnica', 'endurance_sport_performance', 'intermediate', E + S + P,
        [es('A', 'Fuerza pesada A', [block('main_strength', [ex('back_squat', rx(3, (4, 6), (2, 3), 180, 80), E + S, LIN_PCT, SQ), ex('romanian_deadlift', rx(3, (6, 8), (2, 3), 150), E)], 'Fuerza')]),
         es('B', 'Pliometría y técnica', [block('plyometric', [ex('pogo_jumps', rx(3, contacts=15, rest=90), P), ex('broad_jump', rx(3, 4, rest=120), P), ex('single_leg_hop', rx(3, 5, rest=90), P, side='each')], 'Pliometría')], 40),
         es('C', 'Fuerza pesada B', [block('main_strength', [ex('deadlift', rx(3, (4, 6), (2, 3), 180, 80), E + S, LIN_PCT, DL), ex('bulgarian_split_squat', rx(3, (6, 8), (2, 3), 120), E, side='each'), ex('standing_calf_raise', rx(3, (8, 12), (2, 3), 90), E)], 'Fuerza')])], NOTE),
    tpl('iniciacion-2d', 'Iniciación · 2 días (técnica de patrones)', 'strength_initiation', 'beginner', I,
        [session('A', 'Patrones A', [WARM, block('main_strength', [ini('goblet_squat'), ini('incline_push_up'), ini('seated_cable_row'), ini('glute_bridge')], 'Patrones'), block('core', [ex('dead_bug', rx(2, 8)), ex('front_plank', rx(2, dur=20))], 'Core')], 'Técnica de los patrones básicos', 45),
         session('B', 'Patrones B', [WARM, block('main_strength', [ini('step_up_low'), ini('dumbbell_bench_press'), ini('lat_pulldown'), ini('romanian_deadlift')], 'Patrones'), block('core', [ex('bird_dog', rx(2, 8), side='each'), ex('side_plank', rx(2, dur=20), side='each')], 'Core')], 'Técnica de los patrones básicos', 45)], NOTE),
    tpl('iniciacion-3d', 'Iniciación · 3 días (full body)', 'strength_initiation', 'beginner', I,
        [session('A', 'Patrones A', [WARM, block('main_strength', [ini('goblet_squat'), ini('incline_push_up'), ini('seated_cable_row'), ini('glute_bridge')], 'Patrones')], 'Técnica de los patrones básicos', 45),
         session('B', 'Patrones B', [WARM, block('main_strength', [ini('step_up_low'), ini('dumbbell_bench_press'), ini('lat_pulldown'), ini('romanian_deadlift')], 'Patrones')], 'Técnica de los patrones básicos', 45),
         session('C', 'Patrones C', [WARM, block('main_strength', [ini('split_squat'), ini('dumbbell_shoulder_press'), ini('one_arm_dumbbell_row'), ini('farmer_carry', 2, None)], 'Patrones'), block('core', [ex('dead_bug', rx(2, 8)), ex('pallof_press', rx(2, 10), side='each')], 'Core')], 'Técnica de los patrones básicos', 45)], NOTE),
]
# Methods listed by a template must include every method used by its exercises.
for t in T:
    used = {m for s in t['definition']['sessions'] for b in s['blocks'] for e in b['exercises'] for m in e.get('methods', [])}
    t['methods'] = sorted(set(t['methods']) | used)
out = os.path.join(os.path.dirname(__file__), 'templates.json')
json.dump({'_comment': 'Generated by _build.py — edit the generator, not this file.', 'templates': T}, open(out, 'w'), ensure_ascii=False, indent=2)
print(len(T), 'templates')
