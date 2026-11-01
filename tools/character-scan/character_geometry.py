"""Dependency-free full-scan validation, bundle integrity and guide paths."""
import hashlib
import json
import math
from pathlib import Path


def validate_report(report):
    if not isinstance(report,dict) or report.get('schema')!='polpal.character-scan/1':
        raise ValueError('Unsupported Character Scan report')
    def finite(v):
        if isinstance(v,dict):
            for x in v.values():finite(x)
        elif isinstance(v,list):
            for x in v:finite(x)
        elif isinstance(v,float) and not math.isfinite(v):raise ValueError('Nonfinite report value')
    finite(report)
    w,h=report['image']['width'],report['image']['height']
    if type(w) is not int or type(h) is not int or not (32<=w<=50000 and 32<=h<=50000):raise ValueError('Invalid image size')
    reg=report['registration']
    if not (0<=reg['axis_x_px']<w and 0<=reg['ground_y_px']<h and reg['units_per_px']>0):raise ValueError('Invalid registration')
    for part in report['parts'].values():
        if part['status'] not in ('candidate','partial','unknown'):raise ValueError('Invalid part status')
        if 'bbox_px' in part:
            a,b,c,d=part['bbox_px']
            if not (0<=a<c<=w and 0<=b<d<=h):raise ValueError('Invalid part bounds')
    face=report['face']
    if face['status'] not in ('candidate','partial','unknown'):raise ValueError('Invalid face status')
    if face['status']!='unknown' and face.get('report')!='face/face-scan.json':raise ValueError('Invalid face report path')
    for section in report['body']['cross_sections']:
        if not 0<=section['y']<h:raise ValueError('Invalid cross-section row')
        for a,b in section['runs_px']:
            if not 0<=a<=b<w:raise ValueError('Invalid cross-section run')
    previous=-1
    for row in report['body']['width_profile']:
        if not previous<row['y']<h:raise ValueError('Invalid profile rows')
        previous=row['y'];end=-1
        for a,b in row['runs_px']:
            if not (end<a<=b<w):raise ValueError('Invalid foreground runs')
            end=b
    return report


def read_bundle(path):
    path=Path(path);report=validate_report(json.loads(path.read_text()))
    source=Path(report['source'])
    if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=report['source_sha256']:
        raise ValueError('Reference missing or changed; rescan')
    artifacts=report.get('artifacts',{})
    required={'masks/foreground.png','masks/ambiguous.png','masks/unresolved.png','masks/surface_details.png',
              'overview.jpg','parts-overlay.png','body-overlay.png','unresolved-overlay.png',
              'report.md','width-profile.csv','modelling-evidence.json'}
    if report['face']['status']!='unknown':
        required.update({'face/face-scan.json','face/hair-evidence.png','face/face-overlay.png','face/occlusion-overlay.png'})
    required.update(f'masks/part_{n}.png' for n in report['parts'])
    required.update(f'evidence/{n}.png' for n,p in report['parts'].items() if p['area_px']>0)
    if not required<=artifacts.keys():raise ValueError('Incomplete scan bundle')
    for name,digest in artifacts.items():
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Invalid artifact path')
        file=(path.parent/relative).resolve()
        if not file.is_relative_to(path.parent.resolve()):raise ValueError('Artifact outside bundle')
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:
            raise ValueError('Scan artifact missing or changed: '+name)
    if report['face']['status']!='unknown':
        # Loaded by path in Blender; load sibling helper without third-party imports.
        import importlib.util
        spec=importlib.util.spec_from_file_location('polpal_bundle_face_geometry',Path(__file__).with_name('face_geometry.py'))
        helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
        face=helper.validate_report(json.loads((path.parent/report['face']['report']).read_text()))
        helper.validate_profile_source(face)
    return report


def body_lines(report):
    validate_report(report)
    lines=[]
    for section in report['body']['cross_sections']:
        for i,(a,b) in enumerate(section['runs_px']):
            lines.append((f"Visible section {section['height_fraction']:.0%}.{i}",[[a,section['y']],[b,section['y']]]))
    return lines
