"""RACE CONTROLE VCE 2.5.0 — safe capture and explicit Supabase flux diagnostics."""
from pathlib import Path
import ast

root=Path("agent")
def edit(filename,old,new):
    p=root/filename
    source=p.read_text(encoding="utf-8")
    count=source.count(old)
    if count!=1:raise RuntimeError(f"{filename}: expected one occurrence, got {count}: {old[:85]}")
    p.write_text(source.replace(old,new,1),encoding="utf-8")

# A undefined xyz variable prevents every valid AC/ACC sample from being returned.
edit("adapters.py",
     "world_x=as_number(xyz[0],3) if xyz else None,\n             world_z=as_number(xyz[2],3) if xyz else None,",
     "world_x=None, world_z=None,")
# Position coordinates are deliberately unavailable until validated per simulator;
# never invent a race line.

edit("release_updates.py","VERSION='2.4.0'","VERSION='2.5.0'")

# A detected game is not the same as a connected Supabase link.
edit("engine.py",
     "self.log('Liaison en arrière-plan activée. Aucune donnée envoyée sans consentement + approbation STAFF.')",
     """self.log('Capture locale activée. Aucun transfert sans autorisation et association STAFF.')
        if not self.cfg.get('supabase_url') or not self.cfg.get('anon_key'):
            self.log('FLUX DÉCONNECTÉ : URL Supabase / clé publique absente dans Paramètres.')
        elif not self.cfg.get('consent_upload'):
            self.log('FLUX EN ATTENTE : autorisation de transfert du pilote nécessaire.')
        elif not self.cfg.get('registered_pilot_name'):
            self.log('FLUX EN ATTENTE : associer ce PC dans Paramètres, puis valider côté STAFF.')
        else:
            self.log('FLUX : vérification de l’association au serveur en cours.')""")
edit("engine.py",
     """                except Exception:
                    self.approved=False
            if not self.approved""",
     """                except Exception as exc:
                    self.approved=False
                    self.emit('log','FLUX SUPABASE : '+str(exc)[:240])
            if not self.approved""")
# Never silently approve a different pilot.
edit("app.py",
     """    def _status_job(self):
        data=CloudClient(self.cfg).status();self.engine.accept_pairing(data)""",
     """    def _status_job(self):
        try:
            data=CloudClient(self.cfg).status()
            self.engine.accept_pairing(data)
            self.emit('log','FLUX : association '+str(data.get('status','inconnue'))+
                      ' · profil '+str(data.get('pilot_slug') or 'non attribué'))
            if data.get('status')!='approved':
                self.emit('log','Aucun envoi tant que le STAFF n’a pas approuvé ce PC.')
        except Exception as exc:
            self.engine.approved=False
            self.emit('log','FLUX : serveur non joignable ou association absente : '+str(exc)[:240])""")

# Prevent unattended execution of unsigned installer files; keep user-controlled update.
edit("app.py",
     "if self.cfg.get('auto_update',True):self.emit('update_auto',info)",
     "self.emit('log','Mise à jour : ouvrir le menu MÀJ pour l’examiner et la confirmer.')")
edit("app.py",
     "check('Télécharger et installer les nouvelles versions officielles VCE automatiquement',auto_update)",
     "check('Vérifier les mises à jour officielles (installation avec confirmation)',auto_update)")

# Use the existing PUBLIC Supabase browser config as optional app defaults.
# NEVER bundle the service_role; only the publishable or anon key.
import re
public_config=Path("vce-supabase-config.js").read_text(encoding="utf-8")
values=re.findall(r"'([^']+)'",public_config)
public_url=next((v for v in values if v.startswith("https://") and v.endswith(".supabase.co")),None)
public_key=next((v for v in values if v.startswith("eyJ") or v.startswith("sb_publishable_")),None)
if not public_url or not public_key:raise RuntimeError("Configuration Supabase publique non trouvée")
(root/"vce_public_config.py").write_text(
    "PUBLIC_SUPABASE_URL="+repr(public_url)+"\n"+
    "PUBLIC_SUPABASE_ANON="+repr(public_key)+"\n",encoding="utf-8")
edit("app.py",
     "from remote_preferences import get_preferences\n",
     "from remote_preferences import get_preferences\nfrom vce_public_config import PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON\n")
edit("app.py",
     "self.cfg=read_config();self.events=queue.Queue();self.alive=True",
     """self.cfg=read_config();self.events=queue.Queue();self.alive=True
        changed=False
        if not self.cfg.get('supabase_url'):
            self.cfg['supabase_url']=PUBLIC_SUPABASE_URL;changed=True
        if not self.cfg.get('anon_key'):
            self.cfg['anon_key']=PUBLIC_SUPABASE_ANON;changed=True
        if changed:save_config(self.cfg)""")

# The published Windows binary is currently unsigned and triggered an antivirus alert.
# We must not silently launch further installers until that detection is investigated.
edit("app.py",
     """    def _auto_update(self,info):
        if getattr(self,'updating',False):return
        self.updating=True
        self.log_msg('Mise à jour VCE '+info['version']+' : téléchargement vérifié...')
        self._spawn(lambda:self._download_and_install(info))""",
     """    def _auto_update(self,info):
        self.log_msg('Mise à jour '+str(info.get('version',''))+
                     ' disponible : cliquer MÀJ pour confirmer le téléchargement.')""")

# Verify source syntax during Windows build.
for p in root.glob("*.py"):
    ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("VCE 2.5.0 syntax and source compatibility OK")
