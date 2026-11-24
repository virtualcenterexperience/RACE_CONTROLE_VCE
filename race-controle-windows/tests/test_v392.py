"""Offline native 50 Hz, precise inputs and scoring layout regressions."""
import pathlib,sys,unittest,tempfile,struct
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'agent'))
import core
import vce_lmu_native as native
from vce_lmu_scoring import read_participants,SCORING_BASE,VEHICLES_BASE,VEHICLE_SIZE
class Mapping:
    def __init__(self,data):self.data=data
    def read(self,offset,length):return bytes(self.data[offset:offset+length])
class CaptureTests(unittest.TestCase):
    def test_50hz_slots_keep_pedal_precision_and_coordinates(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=core.Recorder('LMU',tmp)
            for i in range(120):
                r.feed(core.Frame(timestamp=1000+i/120,lap=0,world_x=i*.021,world_z=0,brake=.012345,throttle=.99999,extra={'brake_raw':.012349}))
            self.assertEqual(len(r.samples),50)
            self.assertEqual(r.samples[0]['brake'],.012345)
            self.assertEqual(r.samples[0]['brake_raw'],.012349)
            self.assertEqual(r.samples[0]['world_z'],0)
            for i in range(20):r.feed(core.Frame(timestamp=1001+i/20,lap=0))
            self.assertEqual(len(r.samples),70,'Never fake 50Hz if the source is 20Hz')
    def test_scoring_slots_and_missing_chronos(self):
        data=bytearray(native.LMU_MAPPING_SIZE);struct.pack_into('<i',data,SCORING_BASE+104,2)
        for i,name in enumerate([b'PILOT A',b'PILOT B']):
            base=VEHICLES_BASE+i*VEHICLE_SIZE
            struct.pack_into('<i',data,base,i+4);data[base+4:base+4+len(name)]=name
            data[base+196]=int(i==0);data[base+199]=i+1
            struct.pack_into('<d',data,base+144,90+i*.123456)
            struct.pack_into('<d',data,base+168,-1)
        rows=read_participants(Mapping(data));self.assertEqual(len(rows),2)
        self.assertTrue(rows[0]['is_player']);self.assertEqual(rows[1]['best_lap_s'],90.1235)
        self.assertIsNone(rows[0]['last_lap_s'])
        struct.pack_into('<i',data,SCORING_BASE+104,200);self.assertEqual(read_participants(Mapping(data)),[])
    def test_native_mapping_does_not_depend_on_foreground_window(self):
        data=bytearray(native.LMU_MAPPING_SIZE)
        data[native.TELEMETRY_BASE:native.TELEMETRY_BASE+4]=bytes([1,0,1,0])
        struct.pack_into('<i',data,64,2000)
        car=native.VehiclePrefix();car.mElapsedTime=100;car.mLapStartET=90;car.mGear=3
        car.mPos.x=12.3456;car.mPos.z=-20.001;car.mFilteredBrake=.12345;car.mUnfilteredBrake=.12349
        def put():data[native.TELEMETRY_FIRST:native.TELEMETRY_FIRST+len(bytes(car))]=bytes(car)
        put();a=native.LMUAdapter.__new__(native.LMUAdapter);a.mapping=Mapping(data);a.last_elapsed=None;a.last_lap=None;a.last_scoring_at=0;a.participants=[]
        first=a.read();self.assertEqual(first.brake,.12345)
        self.assertEqual(first.extra['brake_raw'],.12349)
        self.assertIsNone(a.read(),'Frozen game frame must not be duplicated')
        car.mElapsedTime+=.02;car.mPos.x+=.1;put()
        second=a.read();self.assertGreater(second.world_x,first.world_x)
if __name__=='__main__':unittest.main()
