import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from mesh_snapshot import protection_vertices
from test_autopilot import fixture


class ProtectionTests(unittest.TestCase):
    def setUp(self):
        self.mesh=fixture()[0]['mesh']
        self.binding={'sha256':'blend','object':'face','frame_id':'fixture','protection':{
            'schema':'polpal.mesh-protection/1','source_blend_sha256':'blend',
            'source_mesh_sha256':self.mesh['sha256'],'object':'face','frame_id':'fixture','protected_vertices':[2,0]}}

    def test_exact_identity_and_indices_are_required(self):
        self.assertEqual(protection_vertices(self.binding,self.mesh),[0,2])
        for key,value in [('source_blend_sha256','other'),('source_mesh_sha256','0'*64),
                          ('object','other'),('frame_id','other'),('protected_vertices',[99999]),
                          ('protected_vertices',[True]),('protected_vertices',[0,0]),('protected_vertices',[])]:
            binding=copy.deepcopy(self.binding);binding['protection'][key]=value
            with self.assertRaises(ValueError):protection_vertices(binding,self.mesh)


if __name__=='__main__':unittest.main()
