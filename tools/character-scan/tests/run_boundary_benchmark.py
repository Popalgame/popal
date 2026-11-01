"""Opt-in labelled synthetic boundary benchmark. No Blender or external image service.

Freeze code before --split heldout; keep failures rather than tuning to those seeds.
This evaluates supplied-mask boundary reasoning, not real-world semantic accuracy.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from unittest.mock import patch

from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from face_shape import analyse_shape,save_shape
from boundary_cases import make_case,KINDS,SPLITS


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--split',choices=tuple(SPLITS),required=True);args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=False);results=[]
    for seed in SPLITS[args.split]:
        for kind in KINDS:
            report,masks,rgb,valid,label=make_case(kind,seed)
            folder=args.out/f'{kind}-{seed}';folder.mkdir();image=folder/'source.png';Image.fromarray(rgb).save(image)
            report['source_sha256']=hashlib.sha256(image.read_bytes()).hexdigest()
            baseline=copy.deepcopy(report)
            with patch('face_shape.chin_neck_context',return_value={'status':'unknown','reasons':['context_disabled']}):
                analyse_shape(baseline,masks,rgb,valid)
            analyse_shape(report,masks,rgb,valid);save_shape(report,rgb,folder)
            detected=report['face_shape']['chin_bottom']['status']!='unknown'
            previous=baseline['face_shape']['chin_bottom']['status']!='unknown'
            label.update(source_sha256=report['source_sha256'],split=args.split)
            (folder/'label.json').write_text(json.dumps(label,indent=2)+'\n')
            results.append({'case':kind,'seed':seed,'expected':label['expected_supported_chin'],
                'detected':detected,'context_disabled':previous,'source_sha256':report['source_sha256'],
                'contexts':report['face_shape']['boundary_evidence']['chin_context']})
    def counts(rows,key):
        tp=sum(r['expected'] and r[key] for r in rows);tn=sum(not r['expected'] and not r[key] for r in rows)
        fp=sum(not r['expected'] and r[key] for r in rows);fn=sum(r['expected'] and not r[key] for r in rows)
        return {'tp':tp,'tn':tn,'fp':fp,'fn':fn,'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None}
    code_root=Path(__file__).resolve().parents[1]
    result={'schema':'polpal.boundary-benchmark/1','split':args.split,'samples':len(results),
        'scope':'Labelled procedural fixtures, known masks and registration. Not independent real-image accuracy.',
        'code_sha256':{name:hashlib.sha256((code_root/name).read_bytes()).hexdigest() for name in ('contour_evidence.py','face_shape.py')},
        'fixture_sha256':hashlib.sha256(Path(__file__).with_name('boundary_cases.py').read_bytes()).hexdigest(),
        'metrics':counts(results,'detected'),'context_disabled_metrics':counts(results,'context_disabled'),
        'per_class':{kind:counts([r for r in results if r['case']==kind],'detected') for kind in KINDS},'cases':results}
    (args.out/'benchmark.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='cases'},indent=2))


if __name__=='__main__':main()
