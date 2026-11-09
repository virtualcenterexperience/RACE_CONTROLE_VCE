"""Le Mans Ultimate native telemetry (read-only LMU_Data, no game DLL).
Layout: Studio 397 SharedMemoryInterface.hpp; container verified against the
MIT-licensed LMU Pitwall implementation (Swizzjack/lmu-pitwall).
No process handles, injection, hooks, plugin installation, or game writes.
"""
import ctypes as ct
import math
import os
import time

from core import Frame

FILE_MAP_READ = 0x0004
LMU_MAPPING_SIZE = 324820
TELEMETRY_BASE = 332 + 1300 + 126832
TELEMETRY_FIRST = TELEMETRY_BASE + 4
VEHICLE_SIZE = 1888
MAX_VEHICLES = 104


class Vector3(ct.LittleEndianStructure):
    _pack_ = 4
    _fields_ = [("x", ct.c_double), ("y", ct.c_double), ("z", ct.c_double)]


class VehiclePrefix(ct.LittleEndianStructure):
    """Verified packed(4) prefix of LMU rF2VehicleTelemetry, 1888-byte record."""
    _pack_ = 4
    _fields_ = [
        ("mID", ct.c_int32), ("mDeltaTime", ct.c_double),
        ("mElapsedTime", ct.c_double), ("mLapNumber", ct.c_int32),
        ("mLapStartET", ct.c_double),
        ("mVehicleName", ct.c_char * 64), ("mTrackName", ct.c_char * 64),
        ("mPos", Vector3), ("mLocalVel", Vector3),
        ("mLocalAccel", Vector3), ("mOri", Vector3 * 3),
        ("mLocalRot", Vector3), ("mLocalRotAccel", Vector3),
        ("mGear", ct.c_int32), ("mEngineRPM", ct.c_double),
        ("mEngineWaterTemp", ct.c_double), ("mEngineOilTemp", ct.c_double),
        ("mClutchRPM", ct.c_double),
        ("mUnfilteredThrottle", ct.c_double),
        ("mUnfilteredBrake", ct.c_double),
        ("mUnfilteredSteering", ct.c_double),
        ("mUnfilteredClutch", ct.c_double),
        ("mFilteredThrottle", ct.c_double),
        ("mFilteredBrake", ct.c_double),
        ("mFilteredSteering", ct.c_double),
        ("mFilteredClutch", ct.c_double),
        ("mSteeringShaftTorque", ct.c_double),
        ("mFront3rdDeflection", ct.c_double),
        ("mRear3rdDeflection", ct.c_double),
        ("mFrontWingHeight", ct.c_double),
        ("mFrontRideHeight", ct.c_double),
        ("mRearRideHeight", ct.c_double),
        ("mDrag", ct.c_double),
        ("mFrontDownforce", ct.c_double),
        ("mRearDownforce", ct.c_double),
        ("mFuel", ct.c_double),
        ("mEngineMaxRPM", ct.c_double),
    ]


def verify_layout():
    assert ct.sizeof(Vector3) == 24
    assert ct.sizeof(VehiclePrefix) == 540
    assert VehiclePrefix.mElapsedTime.offset == 12
    assert VehiclePrefix.mPos.offset == 160
    assert VehiclePrefix.mGear.offset == 352
    assert VehiclePrefix.mUnfilteredThrottle.offset == 388
    assert VehiclePrefix.mFilteredBrake.offset == 428
    assert VehiclePrefix.mFuel.offset == 524
    assert TELEMETRY_FIRST + VEHICLE_SIZE * MAX_VEHICLES == LMU_MAPPING_SIZE


verify_layout()


class ExistingReadOnlyMapping:
    def __init__(self, name="LMU_Data"):
        if os.name != "nt":
            raise OSError("Lecture LMU native disponible uniquement sous Windows")
        from ctypes import wintypes
        self.kernel = ct.WinDLL("kernel32", use_last_error=True)
        self.kernel.OpenFileMappingW.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR)
        self.kernel.OpenFileMappingW.restype = wintypes.HANDLE
        self.kernel.MapViewOfFile.argtypes = (wintypes.HANDLE, wintypes.DWORD,
                                               wintypes.DWORD, wintypes.DWORD, ct.c_size_t)
        self.kernel.MapViewOfFile.restype = ct.c_void_p
        self.kernel.UnmapViewOfFile.argtypes = (ct.c_void_p,)
        self.kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        self.handle = None
        self.ptr = None
        handle = self.kernel.OpenFileMappingW(FILE_MAP_READ, False, name)
        if not handle:
            raise OSError("LMU_Data absent : activer Enable Plugins dans LMU, puis redémarrer le jeu")
        self.handle = handle
        try:
            self.ptr = self.kernel.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, LMU_MAPPING_SIZE)
            if not self.ptr:
                raise OSError("Impossible de lire LMU_Data en mode lecture seule")
        except BaseException:
            self.close()
            raise

    def read(self, offset, length):
        if self.ptr is None or offset < 0 or length < 0 or offset + length > LMU_MAPPING_SIZE:
            raise OSError("Lecture LMU hors limites ou mapping fermé")
        return ct.string_at(self.ptr + offset, length)

    def close(self):
        if self.ptr:
            self.kernel.UnmapViewOfFile(self.ptr)
            self.ptr = None
        if self.handle:
            self.kernel.CloseHandle(self.handle)
            self.handle = None


def bounded(value, minimum, maximum, decimals=5):
    try:
        x = float(value)
        if math.isfinite(x) and minimum <= x <= maximum:
            return round(x, decimals)
    except (TypeError, ValueError, OverflowError):
        pass
    return None


def decoded_name(value):
    return bytes(value).split(b"\0", 1)[0].decode("utf-8", errors="replace").strip()[:100]


class LMUAdapter:
    """Only opens the game's own mapping; no DLLs and no EAC interaction."""
    game = "LMU"

    def __init__(self):
        self.mapping = ExistingReadOnlyMapping()
        self.last_elapsed = None
        self.last_lap = None

    def read(self):
        # LMU's header exposes a direct player slot (0..103).
        header = self.mapping.read(TELEMETRY_BASE, 4)
        active, player, has_car = header[0], header[1], header[2]
        if not (1 <= active <= MAX_VEHICLES and has_car == 1 and player < active):
            return None
        version = int.from_bytes(self.mapping.read(64, 4), "little", signed=True)
        if not (1000 <= version <= 100000):
            return None
        offset = TELEMETRY_FIRST + player * VEHICLE_SIZE
        before = self.mapping.read(offset + VehiclePrefix.mElapsedTime.offset, 8)
        payload = self.mapping.read(offset, ct.sizeof(VehiclePrefix))
        after = self.mapping.read(offset + VehiclePrefix.mElapsedTime.offset, 8)
        if before != after or header != self.mapping.read(TELEMETRY_BASE, 4):
            return None  # writer updated during the copy; retry next poll
        car = VehiclePrefix.from_buffer_copy(payload)
        elapsed = bounded(car.mElapsedTime, 0, 10000000, 6)
        lapstart = bounded(car.mLapStartET, 0, 10000000, 6)
        if elapsed is None or lapstart is None or lapstart > elapsed + 1:
            return None
        if self.last_elapsed is not None and elapsed <= self.last_elapsed:
            return None  # don't fabricate 120 Hz by repeating the same game frame
        throttle = bounded(car.mFilteredThrottle, 0, 1)
        brake = bounded(car.mFilteredBrake, 0, 1)
        steer = bounded(car.mFilteredSteering, -1, 1)
        if throttle is None or brake is None or steer is None:
            return None
        speed_ms = math.sqrt(sum(float(x) ** 2 for x in
            (car.mLocalVel.x, car.mLocalVel.y, car.mLocalVel.z)))
        speed = bounded(speed_ms * 3.6, 0, 800, 3)
        if speed is None or not (-2 <= car.mGear <= 20) or not (0 <= car.mLapNumber <= 100000):
            return None
        world_x = bounded(car.mPos.x, -10000000, 10000000, 4)
        world_z = bounded(car.mPos.z, -10000000, 10000000, 4)
        if world_x is None or world_z is None:
            return None
        self.last_elapsed = elapsed
        self.last_lap = car.mLapNumber
        extras = {}
        for key, val, low, high in [
            ("clutch", car.mFilteredClutch, 0, 1),
            ("throttle_raw", car.mUnfilteredThrottle, 0, 1),
            ("brake_raw", car.mUnfilteredBrake, 0, 1),
            ("steer_raw", car.mUnfilteredSteering, -1, 1),
            ("clutch_raw", car.mUnfilteredClutch, 0, 1),
            ("steering_torque_nm", car.mSteeringShaftTorque, -2000, 2000),
            ("ride_height_front", car.mFrontRideHeight * 1000, -1000, 2000),
            ("ride_height_rear", car.mRearRideHeight * 1000, -1000, 2000),
            ("front_downforce", car.mFrontDownforce, -100000, 100000),
            ("rear_downforce", car.mRearDownforce, -100000, 100000),
            ("drag_n", car.mDrag, -100000, 100000),
            ("engine_water_temp", car.mEngineWaterTemp, -70, 200),
            ("engine_oil_temp", car.mEngineOilTemp, -70, 250),
            ("g_long", car.mLocalAccel.z / 9.80665, -20, 20),
            ("g_lat", car.mLocalAccel.x / 9.80665, -20, 20),
        ]:
            v = bounded(val, low, high)
            if v is not None:
                extras[key] = v
        return Frame(
            timestamp=time.time(), lap=int(car.mLapNumber),
            lap_pos=None, speed_kmh=speed, throttle=throttle, brake=brake,
            steer=steer, gear=int(car.mGear),
            rpm=int(car.mEngineRPM) if bounded(car.mEngineRPM, 0, 30000) is not None else None,
            fuel_l=bounded(car.mFuel, 0, 1000, 3),
            lap_time_ms=int((elapsed - lapstart) * 1000) if lapstart <= elapsed else None,
            last_lap_ms=None, world_x=world_x, world_z=world_z,
            track=decoded_name(car.mTrackName) or "LMU",
            car=decoded_name(car.mVehicleName) or "LMU",
            session_type="other", extra=extras,
        )

    def sample(self):
        return self.read()

    def close(self):
        self.mapping.close()
