"""Face Scan sidebar. Run from this repository or configure Scanner path.

Image analysis runs in external Python; Blender only loads the standard-library
geometry helpers. Generated studies live in AI_Work and never replace the hero.
"""
bl_info={"name":"Polpal Character Scan","author":"Polpal","version":(2,0,0),
         "blender":(5,2,0),"location":"View3D > Sidebar > Character Scan",
         "description":"Local full-character evidence, face/hair, clothing and equipment",
         "category":"3D View"}

import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import time
import uuid

import bpy
from bpy.props import StringProperty,FloatProperty,PointerProperty,EnumProperty
from bpy.app.handlers import persistent
from mathutils import Vector

_RUNNING=None


@persistent
def stop_scan_before_load(_):
    if _RUNNING is not None:
        _RUNNING.stop(bpy.context)


def helpers(settings):
    path=Path(bpy.path.abspath(settings.scanner)).with_name("face_geometry.py")
    spec=importlib.util.spec_from_file_location("polpal_face_geometry",path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def read_report(settings):
    path=Path(bpy.path.abspath(settings.report))
    report=helpers(settings).validate_report(json.loads(path.read_text()))
    helpers(settings).validate_profile_source(report)
    source=Path(report["source"])
    if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=report["source_sha256"]:
        raise ValueError("Reference missing or changed since scan; rescan before using measurements")
    if settings.image and Path(bpy.path.abspath(settings.image)).resolve()!=source.resolve():
        raise ValueError('Selected reference differs from scan; load its report or rescan')
    return report


def character_helpers(settings):
    path=Path(bpy.path.abspath(settings.scanner)).with_name('character_geometry.py')
    spec=importlib.util.spec_from_file_location('polpal_character_geometry',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def adopt_character_report(settings,path):
    path=Path(path);r=character_helpers(settings).read_bundle(path)
    if r['face']['status']!='unknown':adopt_report(settings,path.parent/r['face']['report'])
    else:
        settings.report='';settings.occlusion_status='Face unavailable in this scan'
    settings.character_report=str(path)
    settings.image=r['source']
    reg=r['registration'];settings.axis=reg['axis_x_px'];settings.ground=reg['ground_y_px'];settings.units=reg['units_per_px']
    found=sum(p['area_px']>0 for p in r['parts'].values())
    settings.character_status=f"Part fragments {found}/{len(r['parts'])} | unresolved {r['coverage']['unresolved_px']} px"
    settings.status='Full-character scan loaded'
    return r


def collection(label):
    parent=bpy.data.collections.get("AI_Work")
    if parent is None:
        parent=bpy.data.collections.new("AI_Work");bpy.context.scene.collection.children.link(parent)
    child=bpy.data.collections.new(label);parent.children.link(child)
    return child


def adopt_report(settings,path):
    # Validate before changing the active report or coordinate registration.
    report=helpers(settings).validate_report(json.loads(Path(path).read_text()))
    helpers(settings).validate_profile_source(report)
    settings.report=str(path)
    settings.image=report['source']
    settings.axis=report["registration"]["axis_x_px"]
    settings.ground=report["roi_px"][3]
    cal=report.get('ocular_metrology',{}).get('calibration',{})
    if cal.get('status')=='supplied':
        settings.axis,settings.ground=cal['origin_px']
        settings.mm_per_px=cal['mm_per_px']
        settings.units=cal['mm_per_px']/1000
    ey=report["registration"]["eye_line_y_px"];spacing=report["registration"]["eye_spacing_px"]
    settings.fit_top=ey+.35*spacing;settings.fit_bottom=ey+.70*spacing
    counts={s:sum(f["status"]==s for f in report["features"].values()) for s in ("candidate","partial","unknown")}
    settings.status=f"Candidates {counts['candidate']} | partial {counts['partial']} | unknown {counts['unknown']}"
    guard=report.get("occlusion_guard")
    if guard:
        n=guard["rejected_samples"]
        settings.occlusion_status=f"Excluded contour samples: L {n['left']} / R {n['right']}"
    else:settings.occlusion_status="Legacy scan: rescan before fitting"
    return report


class FACE_SCAN_Settings(bpy.types.PropertyGroup):
    studio_url:StringProperty(name='Studio URL',default='http://127.0.0.1:8772')
    studio_job:StringProperty(name='Immutable mesh job',subtype='FILE_PATH')
    studio_result:StringProperty(name='Fitted result',subtype='FILE_PATH')
    image:StringProperty(name="Reference",subtype='FILE_PATH')
    hints:StringProperty(name="Optional hints JSON",subtype='FILE_PATH')
    scanner:StringProperty(name="Scanner script",subtype='FILE_PATH',default=str(Path(__file__).with_name("face_scan.py")))
    python:StringProperty(name="External Python",subtype='FILE_PATH',default=shutil.which("python3") or "python3")
    output:StringProperty(name="Output directory",subtype='DIR_PATH',default="//face-scans/")
    report:StringProperty(name="Scan JSON",subtype='FILE_PATH')
    status:StringProperty(name="Status",default="Choose reference and scan")
    occlusion_status:StringProperty(name="Occlusion",default="Hair / occlusion: scan required")
    character_report:StringProperty(name="Full scan JSON",subtype='FILE_PATH')
    character_status:StringProperty(name="Character",default="Full-character scan required")
    candidate_report:StringProperty(name="Candidate full scan",subtype='FILE_PATH')
    comparison_report:StringProperty(name="Comparison JSON",subtype='FILE_PATH')
    character_hints:StringProperty(name="Full scan hints JSON",subtype='FILE_PATH')
    character_profile:EnumProperty(name="Profile",items=[('aiko-front','Aiko front','Palette/region priors for Aiko'),
                                                          ('silhouette-only','Silhouette + hints','Only supplied part hypotheses')],default='aiko-front')
    height_mm:FloatProperty(name="Assumed height (mm)",default=1800,min=1,max=100000)
    character_offset:FloatProperty(name="Guide offset X",default=1.3)
    units:FloatProperty(name="Scene units / pixel",default=.001,min=.000001,precision=6)
    axis:FloatProperty(name="Image x at world x=0",default=580)
    ground:FloatProperty(name="Image y at world z=0",default=1973)
    depth:FloatProperty(name="Guide depth Y",default=-.25)
    mm_per_px:FloatProperty(name="Face scale (mm / pixel)",default=0,min=0,precision=6,
                          description="0 leaves standalone face scan uncalibrated; full scan uses its physical registration")
    ocular_summary:StringProperty(name="Ocular measurements",default="Load ocular measurements to view px / mm")
    side_profile:StringProperty(name="Side reference spec JSON",subtype='FILE_PATH',
                               description="Independent side image, source hash, head region/mask and optional scale")
    layout_summary:StringProperty(name="Facial layout",default="Read spacing / ears / profile measurements")
    fit_top:FloatProperty(name="Fit top image Y",default=820)
    fit_bottom:FloatProperty(name="Fit bottom image Y",default=880)
    max_step:FloatProperty(name="Maximum move (pixels)",default=10,min=.1,max=50)
    offset:FloatProperty(name="Copy offset X",default=.65)


class FACE_SCAN_OT_scan(bpy.types.Operator):
    bl_idname="face_scan.scan";bl_label="Scan reference locally"
    bl_description="Run regional face analysis in external Python; results include partial and unknown features"
    scope:EnumProperty(items=[('FACE','Face','Face/hair scan'),('CHARACTER','Character','Full-reference pipeline'),
                              ('COMPARE','Compare','Compare two full-reference bundles')],default='FACE')

    @classmethod
    def poll(cls,context):return _RUNNING is None

    def execute(self,context):
        global _RUNNING
        self.stopped=False;self.cleaned=False
        s=context.scene.face_scan
        try:
            image=Path(bpy.path.abspath(s.image));script=Path(bpy.path.abspath(s.scanner))
            if self.scope!='FACE':script=script.with_name('character_scan.py')
            if not script.is_file() or (self.scope!='COMPARE' and not image.is_file()):raise ValueError("Choose existing reference and scanner script")
            root=Path(bpy.path.abspath(s.output));root.mkdir(parents=True,exist_ok=True)
            stem=time.strftime(self.scope.lower()+"-%Y%m%d-%H%M%S")+"-"+uuid.uuid4().hex[:6]
            self.out=root/stem
            self.log=(root/(stem+".log")).open("w")
            if self.scope=='COMPARE':
                self.out.mkdir()
                command=[bpy.path.abspath(s.python),str(script),'compare',bpy.path.abspath(s.character_report),
                         bpy.path.abspath(s.candidate_report),'--out',str(self.out/'comparison.json')]
            else:
                command=[bpy.path.abspath(s.python),str(script),"scan",str(image),"--out",str(self.out)]
                hints=s.character_hints if self.scope=='CHARACTER' else s.hints
                if hints:command.extend(["--hints",bpy.path.abspath(hints)])
                if s.side_profile:command.extend(['--side-profile',bpy.path.abspath(s.side_profile)])
                if self.scope=='CHARACTER':command.extend(['--profile',s.character_profile,'--height-mm',str(s.height_mm)])
                elif s.mm_per_px>0:command.extend(['--mm-per-px',str(s.mm_per_px),'--origin-px',str(s.axis),str(s.ground)])
            self.process=subprocess.Popen(command,stdout=self.log,stderr=subprocess.STDOUT)
            self.owner=context.scene
            self.timer=context.window_manager.event_timer_add(.3,window=context.window)
            context.window_manager.modal_handler_add(self);_RUNNING=self
            s.status="Scanning locally… (Esc to cancel)"
            return {'RUNNING_MODAL'}
        except Exception as error:
            if hasattr(self,"log"):self.log.close()
            self.report({'ERROR'},str(error));return {'CANCELLED'}

    def cleanup(self,context):
        global _RUNNING
        if self.cleaned:return
        context.window_manager.event_timer_remove(self.timer)
        self.log.close();_RUNNING=None;self.cleaned=True

    def stop(self,context):
        self.stopped=True
        self.process.terminate()
        try:self.process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.process.kill();self.process.wait(timeout=3)
        self.cleanup(context)

    def modal(self,context,event):
        if self.stopped:return {'CANCELLED'}
        if event.type=='ESC':
            self.owner.face_scan.status="Scan cancelled; previous report retained"
            self.stop(context);return {'CANCELLED'}
        if event.type!='TIMER':return {'PASS_THROUGH'}
        code=self.process.poll()
        if code is None:return {'PASS_THROUGH'}
        self.cleanup(context)
        s=self.owner.face_scan
        if code!=0:
            s.status="Scan failed; see log next to output folder"
            self.report({'ERROR'},s.status);return {'CANCELLED'}
        try:
            if self.scope=='CHARACTER':adopt_character_report(s,self.out/'character-scan.json')
            elif self.scope=='COMPARE':
                path=self.out/'comparison.json';r=json.loads(path.read_text())
                s.comparison_report=str(path)
                s.character_status=f"Silhouette IoU {r['silhouette_iou']:.3f} (2D only)"
                s.status='Full-character comparison finished'
            else:adopt_report(s,self.out/"face-scan.json")
        except Exception as error:
            s.status="Invalid result: "+str(error);return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_load(bpy.types.Operator):
    bl_idname="face_scan.load";bl_label="Load scan registration"
    def execute(self,context):
        try:adopt_report(context.scene.face_scan,bpy.path.abspath(context.scene.face_scan.report))
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_guides(bpy.types.Operator):
    bl_idname="face_scan.guides";bl_label="Create reference + measured curves";bl_options={'REGISTER','UNDO'}
    def execute(self,context):
        s=context.scene.face_scan
        try:
            r=read_report(s);lines=helpers(s).polylines(r)
            col=collection("Face Scan • observed 2D curves")
            for name,points,closed in lines:
                data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D'
                data.bevel_depth=s.units*.35;data.bevel_resolution=1
                spline=data.splines.new('POLY');spline.points.add(len(points)-1)
                for p,(x,y) in zip(spline.points,points):p.co=((x-s.axis)*s.units,s.depth,(s.ground-y)*s.units,1)
                spline.use_cyclic_u=closed
                ob=bpy.data.objects.new(name,data);col.objects.link(ob)
                ob["face_scan_source_sha256"]=r["source_sha256"]
                ob["evidence"]="observed 2D candidate/fragment; inspect source overlay"
            image=bpy.data.images.load(r["source"],check_existing=True)
            ob=bpy.data.objects.new("Face Scan • source reference",None);col.objects.link(ob)
            ob.empty_display_type='IMAGE';ob.data=image
            w,h=r["image"]["width"],r["image"]["height"]
            ob.empty_display_size=max(w,h)*s.units
            ob.location=((w/2-s.axis)*s.units,s.depth+.005,(s.ground-h/2)*s.units)
            ob.rotation_euler=(math.pi/2,0,0)
            ob.empty_image_depth='BACK'
            s.status=f"Created {len(lines)} evidence curves in AI_Work"
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_brows(bpy.types.Operator):
    bl_idname="face_scan.brows";bl_label="Generate observed brow fragments";bl_options={'REGISTER','UNDO'}
    bl_description="Make editable 2D ribbon studies from visible brow masks; no hidden ends or forehead depth are invented"
    def execute(self,context):
        s=context.scene.face_scan
        try:
            r=read_report(s);helper=helpers(s);plans=[]
            for side in ("left","right"):
                f=r["features"].get("brow_"+side,{})
                if f.get("status") not in ("candidate","partial"):continue
                plans.append((side,f,helper.brow_mesh(f,s.axis,s.ground,s.units,s.depth)))
            if not plans:raise ValueError("No observed eyebrow fragments in this scan")
            col=collection("Face Scan • generated brow fragment studies")
            for side,f,(vs,fs) in plans:
                data=bpy.data.meshes.new("Observed brow "+side);data.from_pydata(vs,[],fs);data.update()
                ob=bpy.data.objects.new("Brow fragment "+side+" ["+f["status"]+"]",data);col.objects.link(ob)
                mat=bpy.data.materials.new("Observed brow colour "+side)
                rgb=f["colour"]["median_srgb"]
                def linear(v):
                    v=v/255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
                mat.diffuse_color=tuple(linear(v) for v in rgb)+(1,)
                data.materials.append(mat)
                ob["evidence"]=f["status"]+" 2D fragment; depth is presentation-only"
                ob["face_scan_source_sha256"]=r["source_sha256"]
            s.status="Generated visible brow fragments; match forehead depth during modelling"
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_hair_guide(bpy.types.Operator):
    bl_idname="face_scan.hair_guide";bl_label="Create hair evidence image";bl_options={'REGISTER','UNDO'}
    bl_description="Add registered transparent hair candidate image; observed pixels only, not 3D strands"
    def execute(self,context):
        s=context.scene.face_scan
        try:
            r=read_report(s)
            if r['features'].get('hair',{}).get('status','unknown')=='unknown':
                raise ValueError("No hair candidate in this scan")
            path=Path(bpy.path.abspath(s.report)).with_name('hair-evidence.png')
            if not path.is_file():raise ValueError("Missing hair evidence image; rescan")
            image=bpy.data.images.load(str(path),check_existing=True)
            w,h=r['image']['width'],r['image']['height']
            if tuple(image.size)!=(w,h):raise ValueError("Hair evidence image size differs from reference")
            col=collection('Face Scan • hair evidence')
            ob=bpy.data.objects.new('Hair • observed 2D candidate',None);col.objects.link(ob)
            ob.empty_display_type='IMAGE';ob.data=image;ob.empty_display_size=max(w,h)*s.units
            ob.location=((w/2-s.axis)*s.units,s.depth,(s.ground-h/2)*s.units)
            ob.rotation_euler=(math.pi/2,0,0);ob.empty_image_depth='BACK'
            ob['face_scan_source_sha256']=r['source_sha256']
            ob['evidence']='Palette-specific visible hair candidate; depth is presentation only'
            s.status='Created registered hair evidence image in AI_Work'
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_fit(bpy.types.Operator):
    bl_idname="face_scan.fit_copy";bl_label="Fit a copy of selected face";bl_options={'REGISTER','UNDO'}
    bl_description="Fit registered lower-face width to visible skin, bounded per vertex; creates an offset comparison copy"
    @classmethod
    def poll(cls,context):return context.mode=='OBJECT' and context.active_object is not None and context.active_object.type=='MESH'
    def execute(self,context):
        s=context.scene.face_scan;source=context.active_object
        try:
            if source.data.shape_keys or any(m.type=='ARMATURE' for m in source.modifiers):
                raise ValueError("This fitting prototype requires an unrigged mesh without shape keys")
            r=read_report(s);helper=helpers(s)
            points=[tuple(source.matrix_world@v.co) for v in source.data.vertices]
            result,stats=helper.fit_face_points(points,r,s.axis,s.ground,s.units,s.fit_top,s.fit_bottom,s.max_step)
            if not stats["moved_vertices"]:raise ValueError("No vertices moved; check selected face and registration")
            ob=source.copy();ob.data=source.data.copy();ob.name=source.name+" • scan fit study"
            col=collection("Face Scan • fitted face copy");col.objects.link(ob)
            matrix=source.matrix_world.copy();ob.parent=None;ob.matrix_world=matrix
            inverse=matrix.inverted()
            for v,p in zip(ob.data.vertices,result):v.co=inverse@Vector(p)
            ob.data.update();ob.location.x+=s.offset
            ob["face_scan_fit"]=json.dumps(stats);ob["face_scan_source_sha256"]=r["source_sha256"]
            for item in context.selected_objects:item.select_set(False)
            ob.select_set(True);context.view_layer.objects.active=ob
            s.status=f"Fitted copy: {stats['moved_vertices']} vertices; max {stats['maximum_step_px']:.2f}px"
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_ocular(bpy.types.Operator):
    bl_idname='face_scan.ocular';bl_label='Read eye / lash / brow measurements'
    def execute(self,context):
        s=context.scene.face_scan
        try:
            r=read_report(s)
            if 'ocular_metrology' not in r:raise ValueError('Rescan with Character Scan 1.1 for ocular measurements')
            lines=['OCULAR METROLOGY — visible 2D masks',
                   json.dumps(r['ocular_metrology']['calibration'],ensure_ascii=False),'']
            for kind in ('eye','sclera','iris','pupil','lash','brow'):
                for side in ('left','right'):
                    name=kind+'_'+side;f=r['features'][name];g=f.get('geometry_2d')
                    line=name+' | '+f['status']
                    if g:
                        line+=f" | {g['width_px']} x {g['height_px']} px | center {g['centroid_px']}"
                        if 'mm' in g:
                            m=g['mm'];line+=f" | {m['width']:.3f} x {m['height']:.3f} mm | center X/Z {m['centroid_xz']}"
                    lines.append(line)
            lines+=['','Decimal precision is not accuracy. Review ocular-overlay.png.',
                    json.dumps(r['ocular_metrology']['relations'],indent=2)]
            text=bpy.data.texts.new('Ocular measurements • '+r['source_sha256'][:8]);text.write('\n'.join(lines))
            s.ocular_summary='Measurements in Text Editor: '+text.name
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_layout(bpy.types.Operator):
    bl_idname='face_scan.layout';bl_label='Read face / chin / spacing / profile'
    def execute(self,context):
        s=context.scene.face_scan
        try:
            r=read_report(s)
            if 'facial_layout' not in r:raise ValueError('Rescan with Character Scan 1.2')
            lines=['FACIAL SPACING — visible mask centres and projected edge gaps','']
            for name,item in r['facial_layout']['relations'].items():
                line=name+' | '+item['status']
                if 'edge_gap_px' in item:
                    line+=f" | centres {item['centroid_separation_px']:.3f} px | gap {item['edge_gap_px']:.3f} px"
                if 'edge_gap_mm' in item:line+=f" | centres {item['centroid_separation_mm']:.3f} mm | gap {item['edge_gap_mm']:.3f} mm"
                lines.append(line)
            lines+=['','Nose/mouth masks are contrast candidates, not confirmed anatomical landmarks.',
                    'EAR FRAGMENTS:']
            for side in ('left','right'):
                f=r['features']['ear_'+side];g=f.get('geometry_2d',{})
                lines.append(json.dumps({'side':side,'status':f['status'],'width_px':g.get('width_px'),
                                         'height_px':g.get('height_px'),'mm':{k:v for k,v in g.get('mm',{}).items() if k!='contours'},
                                         'position':r['facial_layout']['ears'][side]},ensure_ascii=False))
            profile={k:v for k,v in r['head_profile'].items() if k!='geometry_2d'}
            lines+=['','SIDE PROFILE:',json.dumps(profile,indent=2),'',
                    f"Facial contrast candidates: {len(r['facial_details']['observations'])}. Depth / wrinkles unverified.",
                    'Inspect facial-layout-overlay.png and facial-details-overlay.png. Decimal precision is not accuracy.']
            shape=r.get('face_shape')
            if shape:
                lines+=['','FACE / CHIN CONTOURS:',json.dumps({k:shape[k] for k in ('status','chin_bottom','width_samples','sample_counts','scope','limitations')},indent=2),
                        'Compare face_shape deviations and the comparison overlay; 100% geometry accuracy is not established.']
            text=bpy.data.texts.new('Face geometry 1.3 • '+r['source_sha256'][:8]);text.write('\n'.join(lines))
            s.layout_summary='Text Editor: '+text.name
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


def studio_helpers():
    spec=importlib.util.spec_from_file_location('polpal_blender_studio',Path(__file__).with_name('blender_studio.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


class FACE_SCAN_OT_studio(bpy.types.Operator):
    bl_idname='face_scan.studio';bl_label='Open local Scan Studio'
    def execute(self,context):
        from urllib.parse import urlparse
        url=context.scene.face_scan.studio_url;p=urlparse(url)
        if p.scheme!='http' or p.hostname not in ('127.0.0.1','localhost'):
            self.report({'ERROR'},'Use the local Studio server URL');return {'CANCELLED'}
        bpy.ops.wm.url_open(url=url);return {'FINISHED'}


class FACE_SCAN_OT_snapshot(bpy.types.Operator):
    bl_idname='face_scan.snapshot';bl_label='Export selected mesh snapshot'
    def execute(self,context):
        try:
            s=context.scene.face_scan
            if not s.studio_job:raise ValueError('Choose a new mesh job JSON path')
            studio_helpers().export_snapshot(context.active_object,bpy.path.abspath(s.studio_job))
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_import_fit(bpy.types.Operator):
    bl_idname='face_scan.import_fit';bl_label='Import verified fitted copy';bl_options={'REGISTER','UNDO'}
    def execute(self,context):
        try:
            s=context.scene.face_scan
            job=json.loads(Path(bpy.path.abspath(s.studio_job)).read_text());result=json.loads(Path(bpy.path.abspath(s.studio_result)).read_text())
            studio_helpers().import_result(job,result,collection('Scan Studio / bounded candidates'))
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_PT_panel(bpy.types.Panel):
    bl_label="Character Scan • local 2.0";bl_idname="FACE_SCAN_PT_panel"
    bl_space_type='VIEW_3D';bl_region_type='UI';bl_category="Character Scan"
    def draw(self,context):
        layout=self.layout;s=context.scene.face_scan
        layout.label(text="Local 2D evidence → editable study")
        box=layout.box();box.label(text='Scan Studio 2.0 / annotations + metrology')
        box.prop(s,'studio_url');box.operator('face_scan.studio')
        box.prop(s,'studio_job');box.operator('face_scan.snapshot')
        box.prop(s,'studio_result');box.operator('face_scan.import_fit')
        layout.prop(s,"image")
        box=layout.box();box.prop(s,"python");box.prop(s,"scanner");box.prop(s,"output")
        box=layout.box();box.label(text='Whole character / observed 2D')
        for key in ('character_profile','height_mm','character_hints'):box.prop(s,key)
        box.operator('face_scan.scan',text='Scan whole character locally').scope='CHARACTER'
        box.label(text=s.character_status);box.prop(s,'character_report')
        box.operator('face_scan.load_character');box.prop(s,'character_offset');box.operator('face_scan.character_guides')
        box.prop(s,'candidate_report');box.operator('face_scan.scan',text='Compare full scans').scope='COMPARE'
        box.prop(s,'comparison_report')
        layout.separator();layout.label(text='Face / hair / occlusion')
        layout.prop(s,'side_profile')
        layout.prop(s,'mm_per_px')
        layout.prop(s,'hints');layout.operator("face_scan.scan",text='Scan face only').scope='FACE'
        layout.label(text=s.status)
        layout.label(text=s.occlusion_status)
        layout.separator();layout.prop(s,"report");layout.operator("face_scan.load")
        layout.operator('face_scan.ocular');layout.label(text=s.ocular_summary)
        layout.operator('face_scan.layout');layout.label(text=s.layout_summary)
        box=layout.box();box.label(text="Register image to model")
        for key in ("units","axis","ground","depth"):box.prop(s,key)
        layout.operator("face_scan.guides");layout.operator("face_scan.brows")
        layout.operator("face_scan.hair_guide")
        box=layout.box();box.label(text="Lower-face fit • selected unrigged mesh")
        for key in ("fit_top","fit_bottom","max_step","offset"):box.prop(s,key)
        box.operator("face_scan.fit_copy")
        layout.label(text="Partial = visible fragment, not complete anatomy")


class FACE_SCAN_OT_load_character(bpy.types.Operator):
    bl_idname='face_scan.load_character';bl_label='Load full scan + registration'
    def execute(self,context):
        try:adopt_character_report(context.scene.face_scan,bpy.path.abspath(context.scene.face_scan.character_report))
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


class FACE_SCAN_OT_character_guides(bpy.types.Operator):
    bl_idname='face_scan.character_guides';bl_label='Create full-character evidence guides';bl_options={'REGISTER','UNDO'}
    bl_description='Registered reference, toggleable part masks and measured cross-sections; no hidden geometry'
    def execute(self,context):
        s=context.scene.face_scan
        try:
            path=Path(bpy.path.abspath(s.character_report));helper=character_helpers(s)
            r=helper.read_bundle(path);w,h=r['image']['width'],r['image']['height']
            if s.image and Path(bpy.path.abspath(s.image)).resolve()!=Path(r['source']).resolve():
                raise ValueError('Selected reference differs from full scan; load its report or rescan')
            images=[('Reference • whole character',Path(r['source']),False),
                    ('Classification overlay • candidates',path.parent/'parts-overlay.png',True)]
            images += [(name+' ['+f['status']+']',path.parent/'evidence'/(name+'.png'),True)
                       for name,f in r['parts'].items() if f['area_px']]
            loaded=[]
            for name,file,hidden in images:
                image=bpy.data.images.load(str(file),check_existing=True)
                if tuple(image.size)!=(w,h):raise ValueError('Evidence dimensions differ from reference')
                loaded.append((name,image,hidden))
            col=collection('Character Scan • full-reference evidence')
            for name,image,hidden in loaded:
                image.pack()
                ob=bpy.data.objects.new(name,None);col.objects.link(ob)
                ob.empty_display_type='IMAGE';ob.data=image;ob.empty_display_size=max(w,h)*s.units
                ob.empty_image_offset=(-.5,-.5)
                ob.location=((w/2-s.axis)*s.units+s.character_offset,s.depth,(s.ground-h/2)*s.units)
                ob.rotation_euler=(math.pi/2,0,0);ob.empty_image_depth='BACK'
                ob.hide_set(hidden)
                ob['character_scan_source_sha256']=r['source_sha256'];ob['evidence']='2D observation only; toggle part masks in Outliner'
            lines=helper.body_lines(r)
            for name,points in lines:
                data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=s.units*.4
                spline=data.splines.new('POLY');spline.points.add(len(points)-1)
                for p,(x,y) in zip(spline.points,points):
                    p.co=((x-s.axis)*s.units+s.character_offset,s.depth-.002,(s.ground-y)*s.units,1)
                ob=bpy.data.objects.new(name,data);col.objects.link(ob)
                ob['character_scan_source_sha256']=r['source_sha256']
            s.character_status=f'Created {len(images)} image layers + {len(lines)} cross-sections'
        except Exception as error:self.report({'ERROR'},str(error));return {'CANCELLED'}
        return {'FINISHED'}


CLASSES=(FACE_SCAN_Settings,FACE_SCAN_OT_scan,FACE_SCAN_OT_load,FACE_SCAN_OT_load_character,FACE_SCAN_OT_character_guides,FACE_SCAN_OT_guides,
          FACE_SCAN_OT_brows,FACE_SCAN_OT_hair_guide,FACE_SCAN_OT_fit,FACE_SCAN_OT_ocular,FACE_SCAN_OT_layout,
          FACE_SCAN_OT_studio,FACE_SCAN_OT_snapshot,FACE_SCAN_OT_import_fit,FACE_SCAN_PT_panel)


def register():
    for cls in CLASSES:bpy.utils.register_class(cls)
    bpy.types.Scene.face_scan=PointerProperty(type=FACE_SCAN_Settings)
    bpy.app.handlers.load_pre.append(stop_scan_before_load)


def unregister():
    global _RUNNING
    if _RUNNING is not None:
        _RUNNING.stop(bpy.context)
    if stop_scan_before_load in bpy.app.handlers.load_pre:
        bpy.app.handlers.load_pre.remove(stop_scan_before_load)
    del bpy.types.Scene.face_scan
    for cls in reversed(CLASSES):bpy.utils.unregister_class(cls)


if __name__=="__main__":register()
