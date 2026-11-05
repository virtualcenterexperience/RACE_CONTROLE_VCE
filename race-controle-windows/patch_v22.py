"""Add explicit, reversible telemetry consent to RACE CONTROLE VCE."""
from pathlib import Path
import ast
AGENT=Path("agent")
def rep(s,a,b):
    if s.count(a)!=1:raise RuntimeError("Unrecognized VCE source: "+a[:80])
    return s.replace(a,b,1)
p=AGENT/"app.py";s=p.read_text(encoding="utf-8")
s=rep(s, """        for var in (self.device_text,self.account,self.pair):
            tk.Label(details,textvariable=var,fg=SUB,bg=BG,font=('Segoe UI',9),anchor='w').pack(fill='x',pady=1)
        logfile=tk.Frame""", """        for var in (self.device_text,self.account,self.pair):
            tk.Label(details,textvariable=var,fg=SUB,bg=BG,font=('Segoe UI',9),anchor='w').pack(fill='x',pady=1)
        permission=tk.Frame(self.root,bg=BG)
        permission.pack(fill='x',padx=18,pady=(8,2))
        self.permission_text=tk.StringVar()
        tk.Label(permission,textvariable=self.permission_text,fg=SUB,bg=BG,
                 font=('Segoe UI',9)).pack(side='left')
        self.permission_button=self._button(permission,'AUTORISER',self.transfer_permission)
        self.permission_button.pack(side='right')
        self.refresh_permission()
        logfile=tk.Frame""")
s=rep(s,"    def _button(self,parent,title,fn):\n        return tk.Button", """    def refresh_permission(self):
        permitted=bool(self.cfg.get('consent_upload',False))
        self.permission_text.set('TRANSFERT : AUTORISÉ' if permitted else 'TRANSFERT : DÉSACTIVÉ')
        self.permission_button.configure(text='RÉVOQUER' if permitted else 'AUTORISER LE TRANSFERT')

    def transfer_permission(self):
        if self.cfg.get('consent_upload',False):
            if not messagebox.askyesno('Couper le transfert',
                   'Désactiver l’envoi de télémétrie vers VCE ?\n'
                   'Les sessions restent enregistrées sur ce PC.',parent=self.root):return
            self.cfg['consent_upload']=False
            save_config(self.cfg)
            self.engine.notify_settings()
            self.refresh_permission()
            self.log_msg('Transfert désactivé à la demande du pilote.')
            return
        accepted=messagebox.askyesno('Autorisation de transfert VCE',
             'Autoriser RACE CONTROLE VCE à transmettre tes données de sessions ?\n\n'
             'Données : jeu, circuit, voiture, chronos, trajectoire et télémétrie '
             '(vitesse, frein, accélérateur, volant selon le jeu).\n\n'
             'Elles seront associées à ton profil VCE après approbation du STAFF. '
             'Les pilotes autorisés pourront les comparer dans Race Control.\n\n'
             'Tu peux révoquer cette autorisation à tout moment.\n\n'
             'AUTORISER LE TRANSFERT ?',parent=self.root)
        if not accepted:
            self.log_msg('Transfert refusé : données conservées uniquement sur ce PC.')
            return
        self.cfg['consent_upload']=True
        save_config(self.cfg)
        self.engine.notify_settings()
        self.refresh_permission()
        self.log_msg('Transfert autorisé par le pilote.')
        if not self.cfg.get('pilot_name') or not self.cfg.get('supabase_url'):
            self.log_msg('Profil et serveur à renseigner dans Paramètres avant les envois.')
            messagebox.showinfo('Autorisation enregistrée',
                 'Autorisation enregistrée. Ouvre Paramètres pour associer '
                 'ton profil au STAFF avant le transfert.',parent=self.root)
        elif not self.engine.approved:
            self.log_msg('En attente de validation STAFF avant transmission.')
        else:self.log_msg('Association approuvée : synchronisation autorisée.')

    def _button(self,parent,title,fn):
        return tk.Button""")
s=rep(s,"save_config(self.cfg);self.engine.notify_settings();self.refresh_steam(quiet=True)","save_config(self.cfg);self.engine.notify_settings();self.refresh_steam(quiet=True);self.refresh_permission()")
s=rep(s,"self.root.geometry('535x480');self.root.minsize(460,390)","self.root.geometry('560x510');self.root.minsize(520,440)")
p.write_text(s,encoding="utf-8")
p=AGENT/"release_updates.py";s=p.read_text(encoding="utf-8")
s=rep(s,"VERSION='2.1.0'","VERSION='2.2.0'");p.write_text(s,encoding="utf-8")
p=AGENT/"engine.py";s=p.read_text(encoding="utf-8")
s=rep(s,"                    for lap in item['laps']:cloud.send_lap(item,lap)",
"""                    for lap in item['laps']:
                        if not self.cfg.get('consent_upload',False):break
                        cloud.send_lap(item,lap)
                    if not self.cfg.get('consent_upload',False):continue""")
p.write_text(s,encoding="utf-8")
for p in AGENT.glob("*.py"):ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 2.2 consent patch valid")
