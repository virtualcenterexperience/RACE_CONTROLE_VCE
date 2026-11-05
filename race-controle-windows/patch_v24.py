"""RACE CONTROLE VCE v2.4: reliable tray + update after old executable exits."""
from pathlib import Path
import ast
p=Path('agent/app.py')
s=p.read_text(encoding='utf-8')
def replace(old,new):
    global s
    if s.count(old)!=1:raise RuntimeError('Patch source mismatch: '+old[:85])
    s=s.replace(old,new,1)

replace("if '--minimized' in sys.argv:self.root.withdraw()",
        "self.start_minimized='--minimized' in sys.argv\n        if self.start_minimized:self.root.withdraw()")
replace("        self._make_tray()\n        self.root.after(800,self._startup)",
        "        self._make_tray()\n        self.root.after(5000,self._tray_startup_timeout)\n        self.root.after(2000,self._tray_health)\n        self.root.after(800,self._startup)")
replace("                elif kind=='ui-restore':self.restore()",
"""                elif kind=='tray-ready':
                    self.tray_ok=True
                    self.log_msg('Icône Windows prête : X masque, Quitter arrête.')
                    if self.start_minimized:self.root.withdraw()
                elif kind=='tray-failed':
                    self.tray_ok=False
                    self.log_msg('Zone de notification indisponible : '+str(value))
                    if self.start_minimized:self.root.deiconify();self.root.iconify()
                elif kind=='ui-restore':self.restore()""")
a=s.index('    def _make_tray(self):')
b=s.index('    def quit(self):',a)
s=s[:a]+'''    def _make_tray(self):
        if os.name!='nt':
            self.emit('tray-failed','Windows requis')
            return
        def worker():
            try:
                import pystray
                from PIL import Image,ImageDraw
                img=Image.new('RGB',(64,64),'#0d111b')
                dr=ImageDraw.Draw(img)
                dr.rounded_rectangle((5,5,59,59),radius=13,fill='#142b47',outline='#ff4165',width=4)
                dr.text((15,22),'VCE',fill='#e9f4ff')
                menu=pystray.Menu(
                    pystray.MenuItem('Afficher RACE CONTROLE VCE',lambda *_:self.emit('ui-restore',None),default=True),
                    pystray.MenuItem('Quitter (arrêter la collecte)',lambda *_:self.emit('ui-quit',None)))
                self.tray_icon=pystray.Icon('Race Controle VCE',img,'RACE CONTROLE VCE',menu)
                def ready(icon):
                    icon.visible=True
                    self.emit('tray-ready',None)
                self.tray_icon.run(setup=ready)
            except BaseException as exc:self.emit('tray-failed',str(exc))
        self.tray_thread=threading.Thread(target=worker,daemon=True,name='VCE-notification')
        self.tray_thread.start()

    def _tray_startup_timeout(self):
        if self.start_minimized and not self.tray_ok:
            self.root.deiconify();self.root.iconify()
            self.log_msg('Icône absente : accès conservé dans la barre des tâches.')

    def _tray_health(self):
        if not self.alive:return
        if self.tray_ok and not self.tray_thread.is_alive():
            self.tray_ok=False
            self.log_msg('Zone de notification arrêtée : fenêtre réaffichée.')
            self.root.deiconify();self.root.iconify()
        self.root.after(2000,self._tray_health)

    def _on_unmap(self,event):
        if event.widget==self.root and self.root.state()=='iconic' and self.tray_ok:
            self.root.after(100,self._hide_to_tray)
    def _hide_to_tray(self):
        if self.alive and self.tray_ok and self.tray_thread.is_alive() and self.root.state()=='iconic':
            self.root.withdraw()
    def minimize(self):
        if self.tray_ok and self.tray_thread.is_alive():self.root.withdraw()
        else:
            self.root.iconify()
            self.log_msg('Icône non disponible : réduction dans la barre des tâches.')
    def restore(self):
        self.root.deiconify();self.root.state('normal');self.root.lift();self.root.focus_force()
''' +s[b:]
a=s.index('    def _apply_update(self,path):')
b=s.index('    def _installer_fallback(self,path):',a)
s=s[:a]+'''    def _apply_update(self,path):
        if not os.path.isfile(path):return
        try:
            if os.name!='nt':raise RuntimeError('Windows requis')
            # The independent helper waits until the old .exe has fully exited,
            # avoiding Inno Setup error code 5 (locked executable).
            pid=os.getpid()
            q=lambda x:"'"+str(x).replace("'","''")+"'"
            script=(
                '$ErrorActionPreference="Stop"; '
                'try {Wait-Process -Id '+str(pid)+' -Timeout 90 -ErrorAction SilentlyContinue} catch {}; '
                'if (Get-Process -Id '+str(pid)+' -ErrorAction SilentlyContinue) {exit 20}; '
                'Start-Sleep -Seconds 2; '
                '$p=Start-Process -FilePath '+q(path)+
                " -ArgumentList '/SILENT /NORESTART /CLOSEAPPLICATIONS' -PassThru -Wait; "
                'exit $p.ExitCode'
            )
            subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive',
                '-WindowStyle','Hidden','-Command',script],
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),close_fds=True)
            self.log_msg('Mise à jour après fermeture complète, puis redémarrage réduit.')
            self.quit()
        except Exception as exc:
            self.updating=False
            self.log_msg('Mise à jour non lancée : '+str(exc))
            self._installer_fallback(path)

''' +s[b:]
p.write_text(s,encoding='utf-8')
p=Path('agent/release_updates.py')
s=p.read_text(encoding='utf-8')
if s.count("VERSION='2.3.0'")!=1:raise RuntimeError('Incorrect previous version')
p.write_text(s.replace("VERSION='2.3.0'","VERSION='2.4.0'"),encoding='utf-8')
for f in Path('agent').glob('*.py'):ast.parse(f.read_text(encoding='utf-8'),filename=str(f))
print('RACE CONTROLE VCE v2.4 tray and updater patch verified')
