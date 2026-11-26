"""Preview video of the extras outside the ult (general_fx.py + blink): blinking, footstep marks, Q flow aura with
afterimage prints, recall goal celebration, respawn kick-off, death whistle. Effects come from the built package and
are simulated with vfxsim (an approximation of the game renderer) on the animated striker.

  python3 extras_video.py <fantome> <work dir: built.skl, poses_ours/, dl/png> <out.mp4>
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
ROOT = os.path.join(HERE, '..', '..')
import lolbin as L  # noqa: E402
import vfxsim as S  # noqa: E402
import vfx_preview as VP  # noqa: E402
import general_fx as G  # noqa: E402
import posebin, viz_tex  # noqa: E402
from animtest import Skeleton  # noqa: E402
from model_view import Model  # noqa: E402
from ult_video import char_layer, font, wrap, FPS, W, H, VW, VH  # noqa: E402

CLIP = {'idle1': '477dc1765be45513', 'run_base': 'd9764325bfc64c9f', 'recall': '6c9eb02e478956e1',
        'respawn': '378116753af20c85', 'death': 'de545b9140d5b108'}
RUN_SPEED = 330.0
BLINK = {38, 39, 40, 41}                       # idle1 frames with the eyes closed (build_mod.BLINKS, BLINK_LEN 4)

# (title, lines, clip, clip start frame, seconds, run?, q?, systems [(key, bone or None)])
SEGMENTS = [
    ('Blinzeln', 'Er blinzelt regelmäßig im Stehen|und Laufen - das Gesicht wirkt lebendig.', 'idle1', 22, 2.2, False, False, []),
    ('Laufspuren', 'Bei jedem Schritt Kreide-Striche|und Rasen-Fetzen am Fuß.', 'run_base', 0, 3.0, True, False, [('MV_G_Step', 'steps')]),
    ('Q: Flow-Aura', 'Weiß-violette Funken steigen von Haaren,|Schultern und Füßen auf - dazu leuchtende|Nachbild-Fußabdrücke am Boden.', 'run_base', 0, 3.0, True, True,
     [('MV_G_QAuraBig', 'C_Buffbone_Glb_Head_Loc'), ('MV_G_QAura', 'L_Shoulder'), ('MV_G_QAura', 'R_Shoulder'),
      ('MV_G_QAura', 'L_Buffbone_Glb_Foot_Loc'), ('MV_G_QAura', 'R_Buffbone_Glb_Foot_Loc'),
      ('MV_G_QPrint', 'L_Buffbone_Glb_Foot_Loc'), ('MV_G_QPrint', 'R_Buffbone_Glb_Foot_Loc'), ('MV_G_Step', 'steps')]),
    ('Recall: Torjubel', 'Ein Tor aus Licht baut sich um ihn auf,|der Ball springt auf seinem Fuß ...', 'recall', 0, 3.2, False, False, [('MV_G_Recall', None)]),
    ('Recall: Torjubel', '... am Ende bauscht sich das Netz,|Konfetti fliegt - und er ist weg.', 'recall', 205, 2.0, False, False, [('MV_G_Recall', None)]),
    ('Respawn: Anstoß', 'Ein Mittelkreis zeichnet sich auf den Boden,|ein Flutlicht fällt auf ihn, der Ball liegt|auf dem Anstoßpunkt.', 'respawn', 0, 2.6, False, False, [('MV_G_Respawn', None)]),
    ('Tod: Abpfiff', 'Pfiff-Wellen, eine graue Schockwelle,|der Ball rollt davon und das|Augenleuchten erlischt.', 'death', 0, 3.0, False, False,
     [('MV_G_Death', 'C_Buffbone_Glb_Head_Loc'), ('MV_G_DeathGround', None)]),
]


def emitters_for(b, key, tex, meshes):
    st = b.entry(G.PART + key).struct
    out = []
    for em in st.get('complexEmitterDefinitionData').items:
        e = S.Emitter(em, tex, meshes)
        if e.tex is None:
            continue
        lo = em.get('isLocalOrientation')
        if lo != 0:                                   # facing-relative: the champion faces the camera (south)
            for v in (e.pos, e.vel):
                v.const = v.const * np.array([-1.0, 1, -1])[:len(v.const)] if len(v.const) >= 3 else v.const
                if v.vals is not None and v.vals.shape[1] >= 3:
                    v.vals = v.vals * np.array([-1.0, 1, -1])
        out.append(e)
    return out



def rot_y(P, deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    Q = P.copy(); Q[:, 0], Q[:, 2] = c * P[:, 0] + s * P[:, 2], -s * P[:, 0] + c * P[:, 2]
    return Q


def main():
    fant, work, out = sys.argv[1:4]
    b = VP.load_bin(fant)
    tex = VP.load_textures(os.path.join(work, 'dl', 'png'))
    for n, im in G.textures().items():
        tex[f'assets/characters/yunara/skins/base/particles/mvfx/mvfx_{n}.tex'] = im
    meshes = VP.load_meshes(fant)
    S.GAME_Z['on'] = True
    sk = Skeleton(os.path.join(work, 'built.skl'), os.path.join(ROOT, 'build', 'meshy_striker_joints.json'))
    names = [j.name for j in sk.skl.joints]
    M = Model()
    clips = {k: posebin.PoseClip(os.path.join(work, 'poses_ours', h + '.pose')) for k, h in CLIP.items()}
    frames_dir = os.path.join(work, 'extras_frames'); os.makedirs(frames_dir, exist_ok=True)
    rng = np.random.default_rng(2)
    k_out = 0
    for title, lines, cname, f0, secs, run, q, systems in SEGMENTS:
        clip = clips[cname]
        n = int(secs * FPS)
        span = RUN_SPEED * secs if run else 0.0
        pre = f0 / FPS if cname == 'recall' else 0.0      # the recall effect has been running since frame 0
        attached = []                                     # (emitters, bone or None)
        for key, bone in systems:
            if bone == 'steps':
                continue
            ems = emitters_for(b, key, tex, meshes)
            for tt in np.arange(0.0, pre, 1 / FPS):
                for e in ems:
                    e.step(tt, 1 / FPS, rng, np.zeros(3))
            attached.append((ems, bone))
        steps = [] if not any(bn == 'steps' for _, bn in systems) else []
        last_fr = None
        for i in range(n):
            t = i / FPS
            fr = (f0 + i) % clip.n
            G_ = posebin.globals_at(sk, clip, fr)
            face = None; extra = []
            if cname == 'idle1' and fr in BLINK:
                extra.append('blink')
            if q:
                extra.append('flow')
            if cname == 'death':
                face = 'pain'
            P, T, C = M.skin(sk, G_, face, tuple(extra))
            tx = -span / 2 + RUN_SPEED * t if run else 0.0
            if run:
                P = rot_y(P, 90)                       # running to the right
                P[:, 0] += tx
            def bone_pos(name):
                p = G_[names.index(name)][:3, 3] * np.array([-1.0, 1, 1])
                if run:
                    p = rot_y(p[None], 90)[0]; p[0] += tx
                return p * np.array([1.0, 1, -1])        # sim -> game coordinates (vfxsim mirrors z back)
            cam = S.Camera(VW, VH, target=(tx, 110, 0), dist=1000 if not run else 760, pitch=40, yaw=0, fov=42)   # follows the runner
            bg, zb = char_layer(cam, P, T, C, M.tex, VW, VH)
            S.DEPTH['zb'] = zb
            live = []
            for ems, bone in attached:
                origin = bone_pos(bone) if bone else np.array([tx, 0.0, 0.0])
                if bone is None and not run:
                    origin = np.zeros(3)
                for e in ems:
                    e.step(t + pre, 1 / FPS, rng, origin)
                live += ems
            # footstep events at the contact frames of the run cycle
            if any(bn == 'steps' for _, bn in systems):
                for side, frs in G.STEPS['run_base'].items():
                    if fr in frs and fr != last_fr:
                        es = emitters_for(b, 'MV_G_Step', tex, meshes)
                        o = bone_pos(f'{side}_Buffbone_Glb_Foot_Loc'); o[1] = 0.0
                        for e in es:
                            e.delay += t                   # the event starts the system now (its own time 0)
                            e.step(t, 0.0, rng, o)
                        steps.append((t, es, o))
                for t0, es, o in steps:
                    for e in es:
                        e.step(t, 1 / FPS, rng, o)
                    live += es
            last_fr = fr
            view = S.render_frame(live, cam, t + pre, bg) if live else bg
            hd = G_[names.index('Head')][:3, 3] * np.array([-1, 1, 1.])
            if run:
                hd = rot_y(hd[None], 90)[0]; hd[0] += tx
            fc = viz_tex.render(P, T, C, M.tex, None, size=(300, 300), yaw=10 if not run else 80, pitch=4,
                                center=(hd[0], hd[1] + 8, hd[2]), scale=8.5, bg=(0.1, 0.12, 0.11))
            frame = Image.new('RGB', (W, H), (14, 17, 18))
            frame.paste(Image.fromarray((np.clip(view, 0, 1) * 255).astype(np.uint8)), (20, 40))
            frame.paste(Image.fromarray((fc * 255).astype(np.uint8)), (950, 380))
            dr = ImageDraw.Draw(frame)
            dr.text((950, 40), 'EXTRAS (außer Ult)', font=font(26), fill=(140, 200, 160))
            fs = 46
            while fs > 22 and dr.textlength(title, font=font(fs)) > W - 965:
                fs -= 2
            dr.text((950, 72), title, font=font(fs), fill=(255, 255, 255))
            for j, line in enumerate(wrap(dr, lines.replace('|', ' '), font(17, True), W - 975)):
                dr.text((950, 140 + j * 26), line, font=font(17, True), fill=(190, 205, 195))
            dr.text((950, 356), 'Gesicht', font=font(15, True), fill=(150, 170, 160))
            dr.text((950, 690 - 18), 'Simulation (nicht der Spiel-Renderer)', font=font(13, True), fill=(110, 125, 118))
            frame.save(os.path.join(frames_dir, f'f{k_out:04d}.png')); k_out += 1
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True)
    print('video', out, k_out, 'frames')


if __name__ == '__main__':
    main()
