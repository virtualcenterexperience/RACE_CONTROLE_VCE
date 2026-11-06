"""RACE CONTROLE VCE 3.2.0 — refresh local IP without changing device credentials."""
from pathlib import Path
import ast

root=Path("agent")
def replace(file,old,new):
 p=root/file
 s=p.read_text(encoding="utf-8")
 if s.count(old)!=1:raise RuntimeError(f"{file}: expected one anchor, got {s.count(old)}")
 p.write_text(s.replace(old,new,1),encoding="utf-8")

replace("release_updates.py","VERSION='3.1.0'","VERSION='3.2.0'")

network=root/"local_network.py"
src=network.read_text(encoding="utf-8")
old='''    except OSError:
        pass
    return ""'''
new='''    except (OSError, ValueError):
        pass
    try:
        hosts=socket.getaddrinfo(socket.gethostname(),None,socket.AF_INET)
        for host in hosts:
            candidate=host[4][0]
            address=ipaddress.ip_address(candidate)
            if address.is_private and not address.is_loopback and not address.is_link_local:
                return candidate
    except (OSError, ValueError):
        pass
    return ""'''
if src.count(old)!=1:raise RuntimeError("local_network.py: unexpected source")
network.write_text(src.replace(old,new,1),encoding="utf-8")

replace("engine.py",
        "        last_registration=0\n        self._pairing_notified=False",
        "        last_registration=0\n        last_identity_refresh=0\n        last_reported_ip=None\n        self._pairing_notified=False")
replace("engine.py",
        "            if now-last_status>=30:\n                last_status=now",
        """            if (self.approved and self._identity_matches_registration()
                    and now-last_identity_refresh>=300):
                last_identity_refresh=now
                try:
                    from local_network import local_ipv4
                    ip=local_ipv4()
                    if ip:
                        identity=CloudClient(self.cfg).register(
                            self.cfg.get('registered_pilot_name') or self.cfg.get('pilot_name') or '',
                            self.cfg.get('registered_steam_id64') or '', ip)
                        if identity.get('status')=='approved':
                            if ip!=last_reported_ip:
                                self.log('Identité réseau synchronisée avec STAFF (IP locale détectée)')
                                last_reported_ip=ip
                        else:
                            self.accept_pairing(identity)
                except Exception as exc:
                    self.log('Identité réseau : rafraîchissement reporté ('+str(exc)[:100]+')')
            if now-last_status>=30:
                last_status=now""")

for p in root.glob("*.py"):
 ast.parse(p.read_text(encoding="utf-8"),filename=str(p))
print("RACE CONTROLE VCE 3.2.0: source syntax OK")
