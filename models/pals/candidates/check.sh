#!/bin/bash
# check.sh <тека> <ключ> — читання GLB + повторний імпорт у Blender (BLPY=шлях до python з bpy 5.2) з покадровим програванням кожного кліпу
D=$1; K=$2; H=$(dirname $0)
for g in ${K}_form1 ${K}_form2 ${K}_form3 ${K}_fx; do
  f=$D/$g.glb; [ -f $f ] || continue
  info=$(node $H/lib/inspect.cjs $f | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['tris'],d['joints'],len(d['anims']),d['maxInf'],d['badSum'],d['neg'],d['nonfin'],d['cameras'],round(d['bytes']/1024))")
  re=$(${BLPY:-$H/../bl/bin/python} $H/lib/reimport.py -- $f 2>&1 | grep MAXDISP | awk '{n++; if($NF=="True")ok++} END{print ok"/"n}')
  echo "$g sha=$(sha256sum $f | cut -c1-16) tris/joints/clips/maxInf/badSum/neg/nonfin/cams/KB=$info reimport_finite=$re"
done
