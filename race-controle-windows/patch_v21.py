"""Patch the verified v2.0 source bundle at build time."""
from pathlib import Path
import ast
AGENT=Path("agent")
def replace(text,old,new):
    if text.count(old)!=1:raise RuntimeError("Source mismatch: "+old[:70])
    return text.replace(old,new,1)
p=AGENT/"app.py"
s=p.read_text(encoding="utf-8")
s=replace(s,"import json\nimport os\n","import json\nimport os\nimport subprocess\n")
s=replace(s,"from release_updates import VERSION,check_release,download_release\n","from release_updates import VERSION,check_release,download_release\nfrom remote_preferences import get_preferences\n")
s=replace(s,"self.root=tk.Tk();self.root.title('RACE CONTROLE VCE · v'+VERSION)","self.root=tk.Tk();self.root.title('RACE CONTROLE VCE · v'+VERSION)\n        if '--minimized' in sys.argv:self.root.withdraw()")
s=replace(s,"elif kind=='update':self._show_update(value)\n","elif kind=='update':self._show_update(value)\n                elif kind=='update_auto':self._auto_update(value)\n                elif kind=='apply_update':self._apply_update(value)\n")
s=replace(s,"if info:self.emit('log','Nouvelle version disponible : '+info['version']+' (bouton MÀJ).')","if info:\n                    self.emit('log','Nouvelle version disponible : '+info['version'])\n                    if self.cfg.get('auto_update',True):self.emit('update_auto',info)")
s=replace(s,"self.root.after(3000,self._check_updates_background)\n","self.root.after(3000,self._check_updates_background)\n        self.root.after(8000,self._load_remote_preferences)\n")
s=replace(s,"    def scan(self,quiet=False):\n",'''    def _load_remote_preferences(self):
        def task():
            try:
                prefs=get_preferences()
                if not prefs:return
                delay=prefs.get('sync_delay_s')
                if delay in (10,15,30,60) and self.cfg.get('remote_settings',True):
                    self.cfg['sync_delay_s']=delay
                    save_config(self.cfg)
                    self.engine.notify_settings()
                announcement=prefs.get('announcement','')
                if announcement:self.emit('log','Message VCE : '+announcement)
            except Exception as exc:self.emit('log','Paramètres distants indisponibles : '+str(exc))
        threading.Thread(target=task,daemon=True).start()
        if self.alive:self.root.after(60*60*1000,self._load_remote_preferences)

    def _auto_update(self,info):
        if getattr(self,'updating',False):return
        self.updating=True
        self.log_msg('Mise à jour VCE '+info['version']+' : téléchargement vérifié...')
        self._spawn(lambda:self._download_and_install(info))

    def _download_and_install(self,info):
        try:
            target=app_dir()/'updates'/('Race-Controle-VCE-Setup-'+info['version'].replace('/','')+'.exe')
            path=download_release(info,target)
            self.emit('apply_update',str(path))
        except Exception as exc:
            self.updating=False
            self.emit('log','Mise à jour non installée : '+str(exc))

    def _apply_update(self,path):
        # A verified official GitHub Release installer is the only execution source.
        if not os.path.isfile(path):return
        self.log_msg('Installation vérifiée, redémarrage du launcher...')
        try:
            if os.name!='nt':raise RuntimeError('Installation automatique réservée à Windows')
            subprocess.Popen([path,'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',
                              '/CLOSEAPPLICATIONS','/RESTARTAPPLICATIONS'])
            self.quit()
        except Exception as exc:
            self.updating=False
            self.log_msg('Erreur installation : '+str(exc))

    def scan(self,quiet=False):
''')
s=replace(s,"check('Surveiller automatiquement les jeux tant que le programme reste ouvert',auto)\n","check('Surveiller automatiquement les jeux tant que le programme reste ouvert',auto)\n        auto_update=tk.BooleanVar(value=self.cfg.get('auto_update',True))\n        check('Télécharger et installer les nouvelles versions officielles VCE automatiquement',auto_update)\n")
s=replace(s,"auto_capture=auto.get(),sync_delay_s=int(delay.get()))","auto_capture=auto.get(),auto_update=auto_update.get(),sync_delay_s=int(delay.get()))")
s=replace(s,"self.log_msg('Surveillance automatique après configuration. Réduire dans la zone de notification = continuer.')","self.log_msg('Surveillance au démarrage Windows. Mises à jour automatiques si activées.')")
p.write_text(s,encoding="utf-8")
p=AGENT/"core.py";s=p.read_text(encoding="utf-8");s=replace(s,"cfg.setdefault('auto_capture',True)","cfg.setdefault('auto_capture',True)\n    cfg.setdefault('auto_update',True)\n    cfg.setdefault('remote_settings',True)");p.write_text(s,encoding="utf-8")
p=AGENT/"release_updates.py";s=p.read_text(encoding="utf-8");s=replace(s,"VERSION='2.0.0'","VERSION='2.1.0'");p.write_text(s,encoding="utf-8")
(AGENT/"remote_preferences.py").write_text('''"""Allowlisted remote configuration; never executes remote code."""
import json
import urllib.request
URL='https://raw.githubusercontent.com/virtualcenterexperience/RACE_CONTROLE_VCE/main/race-controle-windows/remote-config.json'
def get_preferences(timeout=8):
    req=urllib.request.Request(URL,headers={'User-Agent':'Race-Controle-VCE/2.1'})
    with urllib.request.urlopen(req,timeout=timeout) as res:
        if res.url!=URL:raise RuntimeError('Redirection inattendue de configuration')
        data=res.read(8193)
    if len(data)>8192:raise RuntimeError('Configuration trop volumineuse')
    doc=json.loads(data)
    if not isinstance(doc,dict) or doc.get('schema')!=1:return {}
    value={}
    if type(doc.get('sync_delay_s')) is int and doc['sync_delay_s'] in (10,15,30,60):value['sync_delay_s']=doc['sync_delay_s']
    if isinstance(doc.get('announcement'),str):value['announcement']=doc['announcement'][:240].replace('\\n',' ')
    return value
''',encoding="utf-8")
for p in AGENT.glob("*.py"):ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 2.1.0 source patch completed")
