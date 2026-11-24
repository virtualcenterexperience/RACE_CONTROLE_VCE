"""Read-only LMU SDK scoring prefix (SharedMemoryInterface pack(4)).
Offsets cross-checked with TeleMU LMUScoringData / LMUVehicleScoring.
No Steam IDs, process scan, guessed offsets or file writes.
"""
import math
import struct
SCORING_BASE=332+1300
VEHICLES_BASE=SCORING_BASE+560
VEHICLE_SIZE=584

def read_participants(mapping):
    header=mapping.read(SCORING_BASE,108)
    if len(header)!=108:return []
    count=struct.unpack_from('<i',header,104)[0]
    if not 1<=count<=104:return []
    raw=mapping.read(VEHICLES_BASE,count*VEHICLE_SIZE)
    if len(raw)!=count*VEHICLE_SIZE:return []
    if header!=mapping.read(SCORING_BASE,108):return []
    rows=[]
    def name(b):return b.split(b'\0',1)[0].decode('utf-8',errors='replace').strip()
    def lap(b,offset):
        value=struct.unpack_from('<d',b,offset)[0]
        return round(value,4) if math.isfinite(value) and 10<=value<=3600 else None
    for i in range(count):
        b=raw[i*VEHICLE_SIZE:(i+1)*VEHICLE_SIZE]
        slot=struct.unpack_from('<i',b,0)[0]
        driver=name(b[4:36]);place=b[199]
        if not (-1<=slot<=100000 and driver and 0<=place<=104 and b[196] in (0,1)):return []
        rows.append({'id':str(slot),'name':driver[:64],'car':name(b[36:100])[:64],
                     'class':name(b[200:232])[:32],'position':place or None,
                     'is_player':bool(b[196]),'laps':max(0,struct.unpack_from('<h',b,100)[0]),
                     'best_lap_s':lap(b,144),'last_lap_s':lap(b,168)})
    return rows
