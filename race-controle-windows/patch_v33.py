"""VCE 3.3: additional AC native physics channels, only when layout validated.
ACC, LMU and ACEVO retain existing collectors; no fabricated sensor values.
"""
from pathlib import Path
import ast
root=Path("agent")
def rep(file,old,new):
 p=root/file;s=p.read_text(encoding="utf-8")
 if s.count(old)!=1:raise RuntimeError(f"{file}: expected one occurrence, got {s.count(old)}")
 p.write_text(s.replace(old,new,1),encoding="utf-8")

rep("release_updates.py","VERSION='3.2.0'","VERSION='3.3.0'")
rep("core.py",
"""    valid: Optional[bool]=None
    def sample(self):""",
"""    valid: Optional[bool]=None
    extra: dict=field(default_factory=dict)
    def sample(self):""")
rep("core.py",
"""        return result

class Recorder:""",
"""        if isinstance(self.extra,dict):
            result.update({k:v for k,v in self.extra.items() if v is not None})
        return result

class Recorder:""")

rep("adapters.py",
"""class ACGraphics(ct.LittleEndianStructure):""",
'''class ACPhysicsPro(ct.LittleEndianStructure):
    """Extended original AC physics layout from the documented shared memory API."""
    _pack_=4
    _fields_=ACPhysics._fields_+[
        ('velocity',ct.c_float*3),('accG',ct.c_float*3),
        ('wheelSlip',ct.c_float*4),('wheelLoad',ct.c_float*4),
        ('wheelsPressure',ct.c_float*4),('wheelAngularSpeed',ct.c_float*4),
        ('tyreWear',ct.c_float*4),('tyreDirtyLevel',ct.c_float*4),
        ('tyreCoreTemperature',ct.c_float*4),('camberRAD',ct.c_float*4),
        ('suspensionTravel',ct.c_float*4),('drs',ct.c_float),('tc',ct.c_float),
        ('heading',ct.c_float),('pitch',ct.c_float),('roll',ct.c_float),
        ('cgHeight',ct.c_float),('carDamage',ct.c_float*5),
        ('numberOfTyresOut',ct.c_int32),('pitLimiterOn',ct.c_int32),
        ('abs',ct.c_float),('kersCharge',ct.c_float),('kersInput',ct.c_float),
        ('autoShifterOn',ct.c_int32),('rideHeight',ct.c_float*2),
        ('turboBoost',ct.c_float),('ballast',ct.c_float),
        ('airDensity',ct.c_float),('airTemp',ct.c_float),('roadTemp',ct.c_float),
        ('localAngularVel',ct.c_float*3),('finalFF',ct.c_float),
        ('performanceMeter',ct.c_float),('engineBrake',ct.c_int32),
        ('ersRecoveryLevel',ct.c_int32),('ersPowerLevel',ct.c_int32),
        ('ersHeatCharging',ct.c_int32),('ersIsCharging',ct.c_int32),
        ('kersCurrentKJ',ct.c_float),('drsAvailable',ct.c_int32),
        ('drsEnabled',ct.c_int32),('brakeTemp',ct.c_float*4),
        ('clutch',ct.c_float),('tyreTempI',ct.c_float*4),
        ('tyreTempM',ct.c_float*4),('tyreTempO',ct.c_float*4)
    ]

class ACGraphics(ct.LittleEndianStructure):''')
rep("adapters.py",
"""        return Frame(timestamp=time.time(),lap=max(0,gr.completedLaps),lap_pos=pos,""",
'''        extra={}
        # Do not parse ACC with the AC layout. Both games have distinct API revisions.
        if self.game=='AC':
            try:
                advanced=ACPhysicsPro.from_buffer_copy(self.pages[0][:ct.sizeof(ACPhysicsPro)])
                if advanced.packetId==ph.packetId and abs(advanced.speedKmh-ph.speedKmh)<.1:
                    def accept(key,value,low,high):
                        v=as_number(value,3)
                        if v is not None and low<=v<=high:extra[key]=v
                    accept('g_long',advanced.accG[1],-20,20)
                    accept('g_lat',advanced.accG[0],-20,20)
                    accept('ride_height_front',advanced.rideHeight[0]*1000,0,1000)
                    accept('ride_height_rear',advanced.rideHeight[1]*1000,0,1000)
                    accept('clutch',advanced.clutch,0,1)
                    accept('air_temp',advanced.airTemp,-70,100)
                    accept('track_temp',advanced.roadTemp,-70,130)
                    for index,suffix in enumerate(('fl','fr','rl','rr')):
                        accept('suspension_'+suffix,advanced.suspensionTravel[index]*1000,-1000,1000)
                        accept('tyre_temp_'+suffix,advanced.tyreCoreTemperature[index],-30,250)
                        accept('tyre_temp_inner_'+suffix,advanced.tyreTempI[index],-30,250)
                        accept('tyre_temp_center_'+suffix,advanced.tyreTempM[index],-30,250)
                        accept('tyre_temp_outer_'+suffix,advanced.tyreTempO[index],-30,250)
                        accept('brake_temp_'+suffix,advanced.brakeTemp[index],-30,1600)
                        accept('tyre_wear_'+suffix,advanced.tyreWear[index],0,110)
                        accept('camber_'+suffix,advanced.camberRAD[index]*57.295779513,-30,30)
            except (BufferError,OSError,ValueError,TypeError,AttributeError):
                pass
        return Frame(timestamp=time.time(),lap=max(0,gr.completedLaps),lap_pos=pos,''')
rep("adapters.py",
"""             session_type={0:'practice',1:'qualifying',2:'race',3:'hotlap',4:'time_attack'}.get(gr.session,'other'))""",
"""             session_type={0:'practice',1:'qualifying',2:'race',3:'hotlap',4:'time_attack'}.get(gr.session,'other'),
             extra=extra)""")

for p in root.glob("*.py"):
 ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 3.3 AC extended native physics source syntax verified")
