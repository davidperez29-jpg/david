"""
Builds the club-workbook golden fixture (restructure phase 4, docs/EVALUATION_SYSTEM.md §6).

The club's workbook holds real players' names and data, so it is NEVER committed. This script
takes it only as *structure*: it deletes the per-player sheets, replaces every name and input
with synthetic values, lets LibreOffice recalculate the workbook's own formulas and writes the
synthetic inputs next to the workbook's outputs to
packages/domain/test/fixtures/club-golden.json.

  python3 scripts/golden/make_club_fixture.py /path/to/INFORME.xlsx

Needs openpyxl and LibreOffice (soffice) on the PATH.
"""
import json
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'packages/domain/test/fixtures/club-golden.json'
ROWS = range(5, 25)  # 20 players
rnd = random.Random(20261005)

SKINFOLDS = [  # (slug, first attempt column, typical mm)
    ('skinfold_triceps', 'AQ', 7.0),
    ('skinfold_subscapular', 'AT', 8.5),
    ('skinfold_iliac_crest', 'AW', 10.0),
    ('skinfold_abdominal', 'AZ', 11.0),
    ('skinfold_front_thigh', 'BC', 9.5),
    ('skinfold_medial_calf', 'BF', 5.5),
]
SPRINTS = [  # (slug, first attempt column, typical s)
    ('sprint_5m', 'BI', 1.05),
    ('sprint_10m', 'BK', 1.75),
    ('sprint_20m', 'BM', 3.0),
    ('sprint_30m', 'BO', 4.15),
    ('cod_505', 'BQ', 4.9),
    ('dribbling', 'BS', 7.9),
]
DIRECT = {  # column → (slug, typical, spread, decimals)
    'Z': ('ift_30_15', 19.5, 1.0, 1),
    'AA': ('imtp_peak_force', 3300, 350, 0),
    'AC': ('cmj_height', 38, 4, 2),
    'AG': ('rsi', 2.5, 0.4, 3),
    'AH': ('dsi', 0.8, 0.12, 3),
}
# Gaps on purpose: not every player completes the battery (N differs by test).
MISSING = {
    7: {'skinfold_medial_calf'},  # Σ4 and Faulkner yes, Σ6 and Yuhasz no
    9: {'sprint_5m', 'sprint_10m', 'sprint_20m', 'sprint_30m'},
    12: {'cmj_height.left'},  # one side only: no asymmetry
    15: {'ift_30_15', 'rsi'},
    18: {'body_mass'},  # no BMI, fat mass or relative strength
}
OUTPUTS = {  # Datos Brutos column → name in the fixture
    'G': 'bmi', 'H': 'skinfold_triceps', 'I': 'skinfold_subscapular',
    'J': 'skinfold_iliac_crest', 'K': 'skinfold_abdominal', 'L': 'skinfold_front_thigh',
    'M': 'skinfold_medial_calf', 'N': 'sum_6_skinfolds', 'O': 'sum_4_skinfolds',
    'P': 'body_fat_faulkner', 'Q': 'body_fat_yuhasz', 'R': 'fat_mass', 'S': 'fat_free_mass',
    'T': 'sprint_5m', 'U': 'sprint_10m', 'V': 'sprint_20m', 'W': 'sprint_30m',
    'X': 'cod_505', 'Y': 'dribbling', 'AB': 'imtp_relative', 'AF': 'cmj_asymmetry',
    'AI': 'z.sum_6_skinfolds', 'AJ': 'z.sprint_5m', 'AK': 'z.sprint_30m',
    'AL': 'z.cmj_height', 'AM': 'z.ift_30_15', 'AN': 'z.rsi', 'AO': 'z.imtp_relative',
}
COLS = {c: openpyxl.utils.column_index_from_string(c) for c in
        [*OUTPUTS, 'E', 'F', 'Z', 'AA', 'AC', 'AD', 'AE', 'AG', 'AH']}


def col(c, k=0):
    return openpyxl.utils.get_column_letter(openpyxl.utils.column_index_from_string(c) + k)


def main():
    tmp = Path(tempfile.mkdtemp())
    wb = openpyxl.load_workbook(SRC)
    for name in list(wb.sheetnames):
        if name.startswith('Ind_') or name == 'Comparativa':
            del wb[name]
    ws = wb['Datos Brutos']
    players = []
    for i, r in enumerate(ROWS, start=1):
        miss = MISSING.get(i, set())
        p = {'name': f'Jugador {i:02d}', 'attempts': {}, 'values': {}}
        ws[f'B{r}'] = p['name']
        ws[f'C{r}'] = None
        ws[f'D{r}'] = None
        # Height: one atypical value (to confirm), like the original sheet had.
        h = 161.3 if i == 20 else round(rnd.gauss(179, 4.5), 1)
        m = round(rnd.gauss(74, 6), 1)
        ws[f'E{r}'] = h
        p['values']['height'] = h
        ws[f'F{r}'] = None if 'body_mass' in miss else m
        if 'body_mass' not in miss:
            p['values']['body_mass'] = m
        for slug, c0, typ, n, sd, dec in (
            [(s, c, t, 3, 0.25, 1) for s, c, t in SKINFOLDS]
            + [(s, c, t, 2, 0.03, 2) for s, c, t in SPRINTS]
        ):
            base = max(typ * 0.5, rnd.gauss(typ, typ * 0.18 if n == 3 else typ * 0.04))
            xs = [round(base + rnd.gauss(0, sd), dec) for _ in range(n)]
            for k in range(n):
                ws[f'{col(c0, k)}{r}'] = None if slug in miss else xs[k]
            if slug not in miss:
                p['attempts'][slug] = xs
        for c, (slug, typ, spread, dec) in DIRECT.items():
            v = round(rnd.gauss(typ, spread), dec) if dec else round(rnd.gauss(typ, spread))
            ws[f'{c}{r}'] = None if slug in miss else v
            if slug not in miss:
                p['values'][slug] = v
        # Relative MTP is an input in the club sheet (N/kg); kept consistent with mass.
        if 'body_mass' not in miss:
            ws[f'AB{r}'] = round(p['values']['imtp_peak_force'] / m, 2)
            p['values']['imtp_relative_input'] = ws[f'AB{r}'].value
        else:
            ws[f'AB{r}'] = None
        right = round(rnd.gauss(19.5, 2), 2)
        left = round(right * rnd.uniform(0.8, 1.05), 2)
        ws[f'AD{r}'] = right
        p['values']['single_leg_cmj_height.right'] = right
        ws[f'AE{r}'] = None if 'cmj_height.left' in miss else left
        if 'cmj_height.left' not in miss:
            p['values']['single_leg_cmj_height.left'] = left
        # Every result cell is the workbook formula (some originals were typed values).
        for c in 'HIJKLMTUVWXY':
            if r != 5:
                ws[f'{c}{r}'] = _shift(ws[f'{c}5'].value, r)
        players.append(p)
    # The original «Altura» best/worst cells mix Spanish function names; written in English here.
    g = wb['Informe Grupal']
    g['H6'] = g['H7'].value.replace('$F$', '$E$').replace('el más pesado', 'el más alto')
    src = tmp / 'club.xlsx'
    wb.save(src)
    out_dir = tmp / 'out'
    subprocess.run(['soffice', f'-env:UserInstallation=file://{tmp}/lo', '--headless', '--calc',
                    '--convert-to', 'xlsx', '--outdir', str(out_dir), str(src)], check=True)
    calc = openpyxl.load_workbook(out_dir / 'club.xlsx', data_only=True)
    d = calc['Datos Brutos']
    for p, r in zip(players, ROWS):
        p['excel'] = {name: _num(d[f'{c}{r}'].value) for c, name in OUTPUTS.items()}
    gr = calc['Informe Grupal']
    group = {}
    for r in range(6, 39):
        label = gr.cell(r, 1).value
        if not label or gr.cell(r, 2).value is None:
            continue
        group[label.strip()] = {
            'n': gr.cell(r, 2).value, 'mean': _num(gr.cell(r, 3).value),
            'sd': _num(gr.cell(r, 5).value), 'max': _num(gr.cell(r, 6).value),
            'min': _num(gr.cell(r, 7).value), 'best': gr.cell(r, 8).value,
            'worst': gr.cell(r, 9).value,
        }
    constants = {
        'faulkner': {'a': ws['C29'].value, 'b': ws['D29'].value},
        'yuhasz': {'a': ws['C30'].value, 'b': ws['D30'].value},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'note': 'Synthetic players; outputs computed by LibreOffice with the club workbook '
                'formulas. Generated by scripts/golden/make_club_fixture.py — no real data.',
        'constants': constants, 'players': players, 'group': group,
    }, ensure_ascii=False, indent=1) + '\n')
    shutil.rmtree(tmp)
    print(f'{OUT} ({len(players)} players, {len(group)} group rows)')


def _shift(formula, r):
    return formula.replace('5:', f'{r}:').replace('5)', f'{r})')


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


if __name__ == '__main__':
    main()
