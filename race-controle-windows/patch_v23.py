"""Installer-reliability and passive-telemetry hotfix for Race Controle VCE v2.3.0.
Applied to the v2.2.0 source during the Windows build.
"""
from pathlib import Path
import ast
AGENT=Path('agent')
def replace(text, old, new):
    if text.count(old)!=1:
        raise RuntimeError(f'Source mismatch for {old[:80]!r}: {text.count(old)} matches')
    return text.replace(old,new,1)

p=AGENT/'adapters.py'
s=p.read_text(encoding='utf-8')
s=replace(s,'import mmap\n','')
s=replace(s,'class ACAdapter:\n','''class ReadOnlyGameMapping:
    """Windows memory: open an existing mapping strictly for reading."""
    FILE_MAP_READ=0x0004
    def __init__(self,name,size):
        if os.name!='nt':raise RuntimeError('Disponible uniquement sur Windows')
        from ctypes import wintypes
        self.kernel=ct.WinDLL('kernel32',use_last_error=True)
        self.kernel.OpenFileMappingW.argtypes=(wintypes.DWORD,wintypes.BOOL,wintypes.LPCWSTR)
        self.kernel.OpenFileMappingW.restype=wintypes.HANDLE
        self.kernel.MapViewOfFile.argtypes=(wintypes.HANDLE,wintypes.DWORD,wintypes.DWORD,wintypes.DWORD,ct.c_size_t)
        self.kernel.MapViewOfFile.restype=ct.c_void_p
        self.kernel.UnmapViewOfFile.argtypes=(ct.c_void_p,)
        self.kernel.UnmapViewOfFile.restype=wintypes.BOOL
        self.kernel.CloseHandle.argtypes=(wintypes.HANDLE,)
        self.kernel.CloseHandle.restype=wintypes.BOOL
        self.handle=None;self.ptr=None;self.size=int(size)
        handle=self.kernel.OpenFileMappingW(self.FILE_MAP_READ,False,name)
        if not handle:raise OSError(ct.get_last_error(),'Mémoire de télémétrie absente : '+name)
        self.handle=handle
        try:
            ptr=self.kernel.MapViewOfFile(handle,self.FILE_MAP_READ,0,0,self.size)
            if not ptr:raise OSError(ct.get_last_error(),'Lecture du mapping impossible : '+name)
            self.ptr=ptr
        except BaseException:
            self.close()
            raise
    def __getitem__(self,sl):
        if not isinstance(sl,slice):raise TypeError('Lecture par tranche uniquement')
        start,stop,step=sl.indices(self.size)
        if step!=1:raise ValueError('Lecture non contiguë')
        if self.ptr is None:raise OSError('Mapping fermé')
        return ct.string_at(self.ptr+start,stop-start)
    def close(self):
        if self.ptr:
            self.kernel.UnmapViewOfFile(self.ptr);self.ptr=None
        if self.handle:
            self.kernel.CloseHandle(self.handle);self.handle=None

class ACAdapter:
''')
s=replace(s,"self.pages.append(mmap.mmap(-1,size,tagname='Local\\\\acpmf_'+page,access=mmap.ACCESS_READ))",
            "self.pages.append(ReadOnlyGameMapping('Local\\\\acpmf_'+page,size))")
start=s.index("        # AC publishes the player's world coordinates directly.")
end=s.index('        return Frame(',start)
s=s[:start]+'''        # World coordinate offsets differ by version: never guess or read
        # another driver's trace. Track progress uses normalizedCarPosition.
'''+s[end:]
p.write_text(s,encoding='utf-8')

p=AGENT/'engine.py';s=p.read_text(encoding='utf-8')
s=replace(s,"if adapter is None:\n                        try:adapter=open_adapter(game);self.log('Lecture mémoire partagée : '+game)",
            "if adapter is None and now>=next_open:\n                        next_open=now+2.5\n                        try:adapter=open_adapter(game);self.log('Lecture mémoire partagée : '+game)")
s=replace(s,"if adapter:adapter.close();adapter=None\n                        with self.guard:self.record=None",
            "if adapter:adapter.close();adapter=None\n                        next_open=0\n                        with self.guard:self.record=None")
s=replace(s,"self.log('Lecture indisponible : '+str(e));adapter.close();adapter=None;frame=None",
            "self.log('Lecture indisponible : '+str(e));adapter.close();adapter=None;next_open=now+3;frame=None")
p.write_text(s,encoding='utf-8')

p=AGENT/'app.py';s=p.read_text(encoding='utf-8')
s=replace(s,'''            subprocess.Popen([path,'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',
                              '/CLOSEAPPLICATIONS','/RESTARTAPPLICATIONS'])
            self.quit()
        except Exception as exc:
            self.updating=False
            self.log_msg('Erreur installation : '+str(exc))''','''            # Use the Windows shell. Do not bypass Windows protections or UAC.
            import ctypes
            shell=ctypes.windll.shell32
            shell.ShellExecuteW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_wchar_p,
                ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_int]
            shell.ShellExecuteW.restype=ctypes.c_void_p
            params='/SILENT /NORESTART /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS'
            result=shell.ShellExecuteW(None,'open',str(path),params,None,1)
            if int(result or 0)<=32:
                raise OSError('Windows refuse l’installateur (code ShellExecute '+str(result)+').')
            self.log_msg('Installateur démarré : accepter les éventuelles confirmations Windows.')
            self.quit()
        except Exception as exc:
            self.updating=False
            self.log_msg('Windows a refusé le lancement : '+str(exc))
            self.log_msg('Mise à jour enregistrée dans : '+str(path))
            self.root.after(0,lambda:self._installer_fallback(path))''')
s=replace(s,'    def scan(self,quiet=False):\n','''    def _installer_fallback(self,path):
        if not os.path.isfile(path):return
        choice=messagebox.askyesno('Mise à jour Windows bloquée',
            'La mise à jour est téléchargée et vérifiée, mais Windows refuse le lancement.\\n\\n'
            'Ouvrir son dossier pour pouvoir la lancer manuellement ?',
            parent=self.root)
        if choice:
            try:os.startfile(str(Path(path).parent))
            except Exception as exc:self.log_msg('Impossible d’ouvrir le dossier : '+str(exc))

    def scan(self,quiet=False):
''')
s=replace(s,"if not quiet:self.emit('log','Jeux installés : '+(', '.join(installed) or 'aucun')+' · lancés : '+(', '.join(running) or 'aucun'))",
"""if not quiet:
                    for code in ('AC','ACC','LMU','R3E'):
                        entry=found.get(code,{})
                        state='EN COURS' if entry.get('running') else 'INSTALLÉ' if entry.get('installed') else 'non détecté'
                        self.emit('log',GAMES[code]['name']+' : '+state)
                    self.emit('log','Lecture seule : aucune modification des dossiers de jeu.')""")
p.write_text(s,encoding='utf-8')
p=AGENT/'release_updates.py';s=p.read_text(encoding='utf-8')
s=replace(s,"VERSION='2.2.0'","VERSION='2.3.0'")
p.write_text(s,encoding='utf-8')
for path in AGENT.glob('*.py'):
    ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
print('VCE 2.3.0 patch valid')
