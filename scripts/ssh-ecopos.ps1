# Conectar por SSH a PC cliente Ecopos (Win7) via tunel reverso en VPS.
# Requisito: en el cliente corriendo scripts\ecopos-tunel-vps.bat
param(
    [string]$VpsHost = "Agencia_dev-VPS-NEW",
    [int]$TunnelPort = 9022,
    [string]$ClientUser = "Ecopos"
)

ssh -J "${VpsHost}" -p $TunnelPort "${ClientUser}@127.0.0.1"
