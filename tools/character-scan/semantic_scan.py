"""Local BiSeNet ONNX proposals, source/model provenance and ambiguity maps."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
from PIL import Image

MODEL_URL='https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx'
MODEL_SHA256='0d9bd318e46987c3bdbfacae9e2c0f461cae1c6ac6ea6d43bbe541a91727e33f'
CLASSES=['background','skin','left_brow','right_brow','left_eye','right_eye','glasses','left_ear','right_ear',
         'ear_accessory','nose','mouth','upper_lip','lower_lip','neck','neck_accessory','clothing','hair','hat']


def install_model(folder):
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True);path=folder/'resnet18.onnx'
    if not path.exists():
        temp=path.with_suffix('.download');urllib.request.urlretrieve(MODEL_URL,temp)
        if hashlib.sha256(temp.read_bytes()).hexdigest()!=MODEL_SHA256:raise ValueError('Model checksum mismatch')
        temp.rename(path)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=MODEL_SHA256:raise ValueError('Model checksum mismatch')
    (folder/'model.json').write_text(json.dumps({'url':MODEL_URL,'sha256':MODEL_SHA256,
        'upstream':'https://github.com/yakhyo/face-parsing','license':'MIT; see THIRD_PARTY.md',
        'training_domain':'CelebAMask-HQ photographs; stylized faces require independent review'},indent=2)+'\n')
    return path


def infer(image_path,model_path,roi,out):
    import onnxruntime as ort
    import cv2
    image_path=Path(image_path);model_path=Path(model_path);out=Path(out)
    if hashlib.sha256(model_path.read_bytes()).hexdigest()!=MODEL_SHA256:raise ValueError('Unexpected model checksum')
    rgba=np.asarray(Image.open(image_path).convert('RGBA'));h,w=rgba.shape[:2]
    x0,y0,x1,y1=map(int,roi)
    if not (0<=x0<x1<=w and 0<=y0<y1<=h):raise ValueError('Invalid semantic face ROI')
    rgb=rgba[y0:y1,x0:x1,:3]
    resized=cv2.resize(rgb,(512,512),interpolation=cv2.INTER_LINEAR).astype(np.float32)/255
    tensor=((resized-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None]
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
    session=ort.InferenceSession(str(model_path),sess_options=options,providers=['CPUExecutionProvider'])
    logits=session.run(None,{session.get_inputs()[0].name:tensor})[0][0]
    logits-=logits.max(axis=0,keepdims=True);prob=np.exp(logits);prob/=prob.sum(axis=0,keepdims=True)
    labels=prob.argmax(0).astype(np.uint8);confidence=prob.max(0)
    entropy=-(prob*np.log(np.maximum(prob,1e-12))).sum(0)/np.log(len(CLASSES))
    labels=cv2.resize(labels,(x1-x0,y1-y0),interpolation=cv2.INTER_NEAREST)
    confidence=cv2.resize(confidence,(x1-x0,y1-y0));entropy=cv2.resize(entropy,(x1-x0,y1-y0))
    full=np.zeros((h,w),np.uint8);full[y0:y1,x0:x1]=labels;full[rgba[:,:,3]<=127]=0
    out.mkdir(parents=True,exist_ok=False)
    Image.fromarray(full).save(out/'labels.png')
    ent=np.zeros((h,w),np.uint8);ent[y0:y1,x0:x1]=np.rint(entropy*255).astype(np.uint8);Image.fromarray(ent).save(out/'entropy.png')
    conf=np.zeros((h,w),np.float32);conf[y0:y1,x0:x1]=confidence
    Image.fromarray(np.rint(conf*255).astype(np.uint8)).save(out/'confidence.png')
    proposals={};axis=(x0+x1)/2;xx=np.indices((h,w))[1]
    groups={'nose':full==10,'mouth':np.isin(full,[11,12,13]),'skin':full==1,'hair':full==17,
            'face_surface':np.isin(full,[1,2,3,4,5,6,10,11,12,13])}
    for kind,ids in (('eye',[4,5]),('brow',[2,3]),('ear',[7,8])):
        for side,part in (('left',xx<axis),('right',xx>=axis)):groups[kind+'_'+side]=np.isin(full,ids)&part
    for name,mask in groups.items():
        file=out/(name+'.png');Image.fromarray(mask.astype(np.uint8)*255).save(file)
        proposals[name]={'path':str(file.resolve()),'status':'candidate' if mask.any() else 'unknown',
                         'pixels':int(mask.sum()),'mean_softmax':float(conf[mask].mean()) if mask.any() else None,
                         'reviewed':False,'origin':'local semantic model proposal'}
    palette=np.array([[int(v) for v in c] for c in ((0,0,0),(242,188,111),(85,235,110),(85,235,110),(90,200,255),(90,200,255),
                     (220,220,220),(240,115,190),(240,115,190),(255,170,60),(255,100,90),(255,85,135),(255,85,135),(255,85,135),
                     (150,130,90),(150,130,90),(110,120,140),(180,120,230),(100,100,100))],np.uint8)
    overlay=rgba[:,:,:3].copy();mask=full>0;overlay[mask]=(overlay[mask]*.55+palette[full[mask]]*.45).astype(np.uint8)
    Image.fromarray(overlay).save(out/'overlay.png')
    report={'schema':'polpal.semantic-proposals/1','source_sha256':hashlib.sha256(image_path.read_bytes()).hexdigest(),
            'model_sha256':MODEL_SHA256,'model_url':MODEL_URL,'roi':list(roi),'classes':CLASSES,'proposals':proposals,
            'calibrated_confidence':False,'limitations':['Photographic training domain; chibi anatomy may fail.',
             'No pupil, iris, sclera or individual eyelash classes. Existing ocular scanner/manual masks handle these.',
             'Softmax/entropy show model ambiguity, not verified anatomical accuracy.']}
    (out/'semantic.json').write_text(json.dumps(report,indent=2)+'\n');return report


if __name__=='__main__':
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
    s=sub.add_parser('install');s.add_argument('folder',type=Path)
    s=sub.add_parser('scan');s.add_argument('image',type=Path);s.add_argument('--model',type=Path,required=True)
    s.add_argument('--roi',nargs=4,type=int,required=True);s.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    print(install_model(a.folder) if a.command=='install' else json.dumps(infer(a.image,a.model,a.roi,a.out),indent=2))
