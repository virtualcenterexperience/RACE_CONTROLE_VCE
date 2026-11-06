"""RACE CONTROLE VCE 2.8.0: pair by device even if no single Steam account is found."""
from pathlib import Path
import ast

root=Path("agent")
def change(filename,old,new):
    file=root/filename
    src=file.read_text(encoding="utf-8")
    if src.count(old)!=1:raise RuntimeError(f"Source changed ({filename}): {old[:85]!r}: {src.count(old)} matches")
    file.write_text(src.replace(old,new,1),encoding="utf-8")

change("release_updates.py","VERSION='2.7.0'","VERSION='2.8.0'")

# SteamID64 is an optional pilot hint. The persistent device ID and random
# secret establish the installation identity; no IP address or SteamID is a password.
change("engine.py",
"""            # Do not send IP, SteamID or any session before user opt-in.
            if not self.cfg.get('steam_id64'):
                if not self._pairing_notified:
                    self.log('STEAM : aucun compte confirmé ; aucun envoi.')
                    self._pairing_notified=True
                continue
            if not self.cfg.get('pilot_name'):
                self.cfg['pilot_name']='Steam '+self.cfg['steam_id64']
                save_config(self.cfg,self.root)""",
"""            # The existing explicit transfer authorization gates all network access.
            # The device can request staff pairing even if Steam has multiple users.
            # Do not guess which driver owns the PC.
            if not self.cfg.get('pilot_name'):
                steam=self.cfg.get('steam_id64','')
                self.cfg['pilot_name']=('Steam '+steam) if steam else ('PC '+str(self.cfg['device_id'])[:8])
                save_config(self.cfg,self.root)
            if not self.cfg.get('steam_id64') and not self._pairing_notified:
                self.log('STEAM : non confirmé · association par identifiant PC proposée au STAFF.')
                self._pairing_notified=True""")
change("engine.py",
"result=cloud.register(self.cfg['pilot_name'],self.cfg['steam_id64'],ip)",
"result=cloud.register(self.cfg['pilot_name'],self.cfg.get('steam_id64',''),ip)")
change("engine.py",
"self.log('IP locale : '+(ip or 'indisponible')+' · SteamID64 : '+self.cfg['steam_id64'])",
"self.log('IP locale : '+(ip or 'indisponible')+' · SteamID64 : '+(self.cfg.get('steam_id64') or 'non détecté'))")
change("engine.py",
"self.log('Enregistrement envoyé au STAFF : '+str(result.get('status','pending')))",
"self.log('Demande de liaison envoyée au STAFF : '+str(result.get('status','pending'))+' · PC '+str(self.cfg['device_id'])[:8])")

# Notification when a single Steam user is found; never hardcode one specific ID.
change("app.py",
"self.log_msg('STEAM : sélection du compte nécessaire (plusieurs comptes ou Steam absent).')",
"self.log_msg('STEAM : compte ambigu ou absent. Liaison automatique du PC possible sans sélection.')")

for file in root.glob("*.py"):
    ast.parse(file.read_text(encoding="utf-8"),filename=str(file))
print("VCE 2.8 optional Steam auto-pair patch: syntax OK")
