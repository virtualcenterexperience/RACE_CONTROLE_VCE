"""VCE 2.7: auto-enrol approved telemetry devices after opt-in, without settings UI."""
from pathlib import Path
import ast

BASE=Path("agent")
def change(filename,needle,replacement):
    path=BASE/filename
    source=path.read_text(encoding="utf-8")
    hits=source.count(needle)
    if hits!=1:raise RuntimeError(f"{filename}: expected one anchor, got {hits}: {needle[:65]}")
    path.write_text(source.replace(needle,replacement,1),encoding="utf-8")

change("release_updates.py","VERSION='2.6.0'","VERSION='2.7.0'")

# Steam's VDF suggests the last account, but does not prove identity.
# Never select ambiguously when two Steam accounts have no unique recent entry.
change("app.py",
    "    def _startup(self):\n        self.refresh_steam(quiet=True)",
    """    def _startup(self):
        self.refresh_steam(quiet=True)
        self._suggest_steam_identity()""")
change("app.py",
    "    def _check_updates_background(self):",
    """    def _suggest_steam_identity(self):
        if not self.cfg.get('consent_upload',False):
            return
        if self.cfg.get('steam_id64'):
            return
        accounts=getattr(self,'accounts',[]) or []
        recent=[x for x in accounts if x.get('most_recent')]
        chosen=recent[0] if len(recent)==1 else accounts[0] if len(accounts)==1 else None
        if chosen is None:
            self.log_msg('STEAM : sélection du compte nécessaire (plusieurs comptes ou Steam absent).')
            return
        steamid=chosen.get('steam_id64','')
        if not steamid:return
        self.cfg['steam_id64']=steamid
        if not self.cfg.get('pilot_name'):
            self.cfg['pilot_name']='Steam '+steamid
        save_config(self.cfg)
        self.account.set('STEAM ID64 : '+steamid+' · '+(chosen.get('persona_name') or chosen.get('account_name') or 'Steam'))
        self.log_msg('SteamID64 détecté · '+steamid+' · demande STAFF automatique')
        self.engine.notify_settings()

    def _check_updates_background(self):""")

# When a user has already consented, the engine registers automatically before querying status.
# A SteamID is only a suggestion for staff matching; device_secret remains the credential.
change("engine.py",
    "    def _sync(self):\n        last_status=0;last_upload=0;last_cloud_error=''",
    """    def _sync(self):
        last_status=0;last_upload=0;last_cloud_error=''
        last_registration=0
        self._pairing_notified=False""")
change("engine.py",
    """            now=time.monotonic()
            if now-last_status>=30:
                last_status=now
                try:
                    result=CloudClient(self.cfg).status()
                    self.accept_pairing(result)
                except Exception as exc:
                    self.approved=False
                    self.emit('log','FLUX SUPABASE : '+str(exc)[:240])
            if not self.approved""",
    """            now=time.monotonic()
            # Do not send IP, SteamID or any session before user opt-in.
            if not self.cfg.get('steam_id64'):
                if not self._pairing_notified:
                    self.log('STEAM : aucun compte confirmé ; aucun envoi.')
                    self._pairing_notified=True
                continue
            if not self.cfg.get('pilot_name'):
                self.cfg['pilot_name']='Steam '+self.cfg['steam_id64']
                save_config(self.cfg,self.root)
            same=self._identity_matches_registration()
            if not same and now-last_registration>=30:
                last_registration=now
                try:
                    from local_network import local_ipv4
                    ip=local_ipv4()
                    cloud=CloudClient(self.cfg)
                    result=cloud.register(self.cfg['pilot_name'],self.cfg['steam_id64'],ip)
                    self.cfg['registered_steam_id64']=self.cfg['steam_id64']
                    self.cfg['registered_pilot_name']=self.cfg['pilot_name']
                    save_config(self.cfg,self.root)
                    self.log('IP locale : '+(ip or 'indisponible')+' · SteamID64 : '+self.cfg['steam_id64'])
                    self.log('Enregistrement envoyé au STAFF : '+str(result.get('status','pending')))
                    self.accept_pairing(result)
                    last_status=now
                except Exception as exc:
                    self.approved=False
                    err=str(exc)[:170]
                    if err!=last_cloud_error:
                        self.log('Inscription VCE impossible : '+err)
                    last_cloud_error=err
                continue
            if now-last_status>=30:
                last_status=now
                try:
                    result=CloudClient(self.cfg).status()
                    self.accept_pairing(result)
                    if result.get('status')=='approved' and not self._pairing_notified:
                        self.log('Connexion STAFF validée · profil '+str(result.get('pilot_slug') or ''))
                        self._pairing_notified=True
                except Exception as exc:
                    self.approved=False
                    err=str(exc)[:170]
                    if 'PC inconnu' in err:
                        self.cfg.pop('registered_pilot_name',None)
                        self.cfg.pop('registered_steam_id64',None)
                        save_config(self.cfg,self.root)
                        self.log('Enregistrement serveur manquant : nouvelle demande de liaison.')
                    elif err!=last_cloud_error:
                        self.log('FLUX SUPABASE : '+err)
                    last_cloud_error=err
            if not self.approved""")

# Add local non-credential network diagnostics. It never opens inbound firewall ports.
(BASE/"local_network.py").write_text('''"""Local LAN address for diagnostics; never used for authentication."""
import ipaddress
import socket

def local_ipv4():
    try:
        with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as sock:
            sock.connect(("192.0.2.1",1))
            ip=sock.getsockname()[0]
        value=ipaddress.ip_address(ip)
        if value.version==4 and value.is_private and not value.is_loopback:
            return ip
    except OSError:
        pass
    return ""
''',encoding="utf-8")
change("client.py",
    "def _register_v2(self,name,steam_id64=''):",
    "def _register_v2(self,name,steam_id64='',local_ip=''):")
change("client.py",
    "return self.post('register',{'requested_pilot':name[:100], 'steam_id64':steam_id64})",
    "return self.post('register',{'requested_pilot':name[:100], 'steam_id64':steam_id64, 'local_ip':local_ip})")

# Source syntax validation before Windows packaging.
for path in BASE.glob("*.py"):
    ast.parse(path.read_text(encoding="utf-8"),filename=str(path))
print("VCE 2.7 Auto-enrolment source verified")
