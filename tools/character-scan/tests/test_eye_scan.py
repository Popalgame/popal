"""Known ocular targets, topology, scale and provenance, not implementation mirrors."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import eye_scan
import face_scan
import face_geometry


def fixture(highlight=False, pupils=True):
    image=Image.new('RGBA',(400,400),(40,40,45,255));draw=ImageDraw.Draw(image)
    draw.ellipse((40,40,360,360),fill=(240,180,140,255))
    for x in (130,270):
        draw.ellipse((x-44,158,x+44,234),fill=(25,15,12,255))
        draw.ellipse((x-40,166,x+40,230),fill=(232,225,218,255))
        draw.ellipse((x-19,173,x+19,225),fill=(30,150,155,255))
        if pupils:draw.ellipse((x-8,185,x+8,214),fill=(3,18,20,255))
        if highlight:draw.ellipse((x-3,193,x+3,199),fill=(245,245,245,255))
    draw.polygon([(86,117),(166,132),(166,141),(86,126)],fill=(180,65,105,255))
    draw.polygon([(234,132),(314,117),(314,126),(234,141)],fill=(180,65,105,255))
    return image


class OcularTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'face.png'
        self.hints={'eye_centers_px':[[130,200],[270,200]],'roi':[30,80,370,350]}

    def scan(self,**kwargs):
        fixture(**kwargs).save(self.path)
        return face_scan.scan_face(self.path,hints=self.hints,
                                   calibration={'mm_per_px':.4,'origin_px':[200,350]})

    def test_known_pupil_position_size_and_sclera_not_highlight(self):
        r,m,_=self.scan()
        for side,x in (('left',130),('right',270)):
            g=r['features']['pupil_'+side]['geometry_2d']
            self.assertAlmostEqual(g['centroid_px'][0],x,delta=1)
            self.assertAlmostEqual(g['centroid_px'][1],199.5,delta=2)
            self.assertAlmostEqual(g['width_px'],17,delta=3)
            self.assertAlmostEqual(g['height_px'],30,delta=4)
            self.assertTrue(m['sclera_'+side][200,x-30])
            self.assertFalse(m['sclera_'+side][200,x])
            self.assertTrue(m['lash_'+side][162,x])
            self.assertGreater(r['features']['eye_'+side]['geometry_2d']['width_px'],70)
        face_geometry.validate_report(r)

    def test_highlight_exclusion_and_missing_pupil(self):
        r,m,_=self.scan(highlight=True)
        self.assertFalse(m['sclera_left'][196,130])
        self.assertFalse(m['pupil_left'][196,130])
        self.assertEqual(r['features']['pupil_left']['status'],'partial')
        r,m,_=self.scan(pupils=False)
        self.assertEqual(r['features']['pupil_left']['status'],'unknown')
        self.assertFalse(m['pupil_left'].any())

    def test_scale_origin_and_relations_are_applied_once(self):
        r,_,_=self.scan()
        f=r['features']['pupil_left'];g=f['geometry_2d'];mm=g['mm']
        self.assertAlmostEqual(mm['width'],g['width_px']*.4)
        self.assertAlmostEqual(mm['area_mm2'],g['area_px2']*.16)
        self.assertAlmostEqual(mm['centroid_xz'][0],-28,delta=.4)
        self.assertAlmostEqual(mm['centroid_xz'][1],60.2,delta=.8)
        self.assertAlmostEqual(r['ocular_metrology']['left_right']['pupil']['centroid_separation_mm'],56,delta=.4)
        self.assertFalse(r['ocular_metrology']['calibration']['accuracy_1mm_verified'])
        self.assertEqual(r['ocular_metrology']['calibration']['sampling_extent_one_pixel_mm'],.4)

    def test_uncalibrated_and_bad_calibration(self):
        fixture().save(self.path)
        r,_,_=face_scan.scan_face(self.path,hints=self.hints)
        self.assertNotIn('mm',r['features']['eye_left']['geometry_2d'])
        for value in (0,-1,float('nan'),float('inf')):
            with self.assertRaises(ValueError):
                face_scan.scan_face(self.path,hints=self.hints,calibration={'mm_per_px':value})

    def test_transparent_pupil_pixels_never_measured(self):
        a=np.array(fixture());a[180:220,120:140,3]=0;Image.fromarray(a).save(self.path)
        r,m,_=face_scan.scan_face(self.path,hints=self.hints)
        for kind in eye_scan.KINDS:
            self.assertFalse(m[kind+'_left'][a[...,3]==0].any())
        self.assertEqual(r['features']['eye_left']['status'],'partial')

    def test_geometry_holes_disconnected_runs_and_half_pixel_edges(self):
        mask=np.zeros((30,40),bool);mask[4:20,3:16]=True;mask[8:15,7:12]=False
        mask[22:26,25:31]=True;mask[26,31]=True  # corner-only contact
        g=eye_scan.geometry(mask)
        self.assertEqual(sum(c['signed_area_px2'] for c in g['contours']),int(mask.sum()))
        self.assertEqual(sum(c['hole'] for c in g['contours']),1)
        self.assertEqual(g['component_count'],3)
        self.assertEqual(next(r[1] for r in g['row_runs_px'] if r[0]==10),[[3,6],[12,15]])
        self.assertEqual(min(p[0] for c in g['contours'] for p in c['points_px']),2.5)

    def test_guide_contours_preserve_mask_holes_and_reject_invalid_points(self):
        r,_,_=self.scan(highlight=True)
        f=r['features']['iris_left'];contours=f['geometry_2d']['contours']
        lines=[line for line in face_geometry.polylines(r) if line[0].startswith('iris_left.')]
        self.assertEqual(len(lines),len(contours))
        bad=copy.deepcopy(r);bad['features']['iris_left']['geometry_2d']['contours'][0]['points_px'][0]=[-2,5]
        with self.assertRaisesRegex(ValueError,'outside'):face_geometry.validate_report(bad)

    def test_numeric_output_and_comparison(self):
        r,m,rgb=self.scan();out=Path(self.temp.name)/'out'
        face_scan.save_scan(r,m,rgb,out)
        self.assertTrue((out/'ocular-overlay.png').is_file())
        self.assertIn('pupil_left',(out/'ocular-measurements.csv').read_text())
        loaded=json.loads((out/'face-scan.json').read_text())
        d=face_scan.compare_scans(loaded,loaded)['features']['pupil_left']
        self.assertEqual(d['calibrated_mm']['width_delta'],0)
        self.assertEqual(d['calibrated_mm']['centroid_xz_delta'],[0,0])

    def test_resampling_keeps_physical_dimensions(self):
        a,_,_=self.scan()
        fixture().resize((800,800),Image.Resampling.NEAREST).save(self.path)
        h={'eye_centers_px':[[260,400],[540,400]],'roi':[60,160,740,700]}
        b,_,_=face_scan.scan_face(self.path,hints=h,calibration={'mm_per_px':.2,'origin_px':[400,700]})
        for kind in ('eye','pupil','iris','sclera','brow'):
            ga=a['features'][kind+'_left']['geometry_2d']['mm']
            gb=b['features'][kind+'_left']['geometry_2d']['mm']
            self.assertAlmostEqual(ga['width'],gb['width'],delta=1)
            self.assertAlmostEqual(ga['height'],gb['height'],delta=1)

    def test_reviewed_mask_provenance_exact_extent_and_stale_source(self):
        fixture().save(self.path)
        mask=np.zeros((400,400),np.uint8);mask[190:211,124:137]=255
        path=Path(self.temp.name)/'pupil.png';Image.fromarray(mask).save(path)
        h=copy.deepcopy(self.hints)
        h['feature_masks']={'pupil_left':{'path':str(path),'status':'candidate',
                            'source_sha256':hashlib.sha256(self.path.read_bytes()).hexdigest()}}
        r,_,_=face_scan.scan_face(self.path,hints=h,calibration={'mm_per_px':.5})
        f=r['features']['pupil_left'];self.assertIn('annotation',f)
        self.assertEqual(f['geometry_2d']['mm']['width'],6.5)
        self.assertEqual(f['geometry_2d']['mm']['height'],10.5)
        h['feature_masks']['pupil_left']['source_sha256']='changed'
        with self.assertRaisesRegex(ValueError,'source_sha256'):face_scan.scan_face(self.path,hints=h)

    def test_partial_fragment_deltas_stay_explicit(self):
        r,_,_=self.scan(highlight=True)
        comparison=face_scan.compare_scans(r,r)
        self.assertIn('pupil_left',comparison['skipped'])
        fragment=comparison['ocular_visible_fragments']['pupil_left']
        self.assertEqual(fragment['reference_status'],'partial')
        self.assertEqual(fragment['calibrated_mm']['width_delta'],0)

    def test_sclera_leaking_into_search_boundary_is_rejected(self):
        im=fixture();d=ImageDraw.Draw(im)
        d.rectangle((60,190,110,205),fill=(232,225,218,255));im.save(self.path)
        r,m,_=face_scan.scan_face(self.path,hints=self.hints)
        self.assertFalse(m['sclera_left'][200,70])
        self.assertGreater(r['features']['sclera_left']['rejected_sclera_components'],0)


if __name__=='__main__':unittest.main()
