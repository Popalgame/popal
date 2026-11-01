#!/usr/bin/env python3
"""Package the local addon and all offline scanner dependencies (not Python wheels)."""
import argparse
import ast
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED

FILES=('blender_face_scan.py','scan.py','face_scan.py','face_geometry.py','hair_scan.py',
        'occlusion.py','eye_scan.py','facial_layout.py','head_profile.py','face_shape.py','body_scan.py','part_scan.py','character_scan.py','character_geometry.py',
        'studio.py','studio_project.py','metrology3d.py','deviation.py','semantic_scan.py','mesh_fit.py','mesh_snapshot.py','blender_studio.py','benchmark.py',
        'autopilot.py','outline_objective.py','contour_evidence.py','fit_diagnosis.py','blender_pipeline.py','blender_pipeline_worker.py','automatic_camera.py','blender_landmarks.py',
        'studio-web/index.html','studio-web/style.css','studio-web/app.js','requirements-studio.txt','THIRD_PARTY.md',
        'README.md','requirements.txt','examples/aiko-registration.json','examples/aiko-independent-annotations.json')


def build(output):
    root=Path(__file__).resolve().parent
    for name in FILES:
        if not (root/name).is_file():raise FileNotFoundError(root/name)
        if name.endswith('.py'):ast.parse((root/name).read_text(),filename=name)
    with ZipFile(output,'x',ZIP_DEFLATED) as archive:
        bridge=root/'studio_bridge.py'
        if not bridge.exists():bridge=root.parent/'blender-mcp/bridge_client.py'
        ast.parse(bridge.read_text());archive.write(bridge,'polpal_face_scan/studio_bridge.py')
        for name in FILES:
            target='__init__.py' if name=='blender_face_scan.py' else name
            archive.write(root/name,'polpal_face_scan/'+target)
    return Path(output)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('output',type=Path)
    print(build(p.parse_args().output).resolve())
