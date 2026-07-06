# Acceso remoto PC cliente Ecopos (Win7, 192.168.0.15)

No se puede `ssh 192.168.0.15` desde otra red. Opciones:

## A) AnyDesk (ya funciona)

- ID: **401 688 203**
- Transferencia de archivos desde el menú AnyDesk

## B) SSH via tunel al VPS (acceso desde cualquier red)

### En la PC del cliente (una vez)

1. Descargar **PuTTY 32-bit**: https://the.earth.li/~sgtatham/putty/latest/w32/putty.zip
2. Extraer `plink.exe` → `C:\PuTTY\plink.exe`
3. Copiar `scripts\ecopos-tunel-vps.bat` al escritorio
4. Doble clic en el `.bat` → pedira contraseña del usuario `dev_taup` en el VPS
5. **Dejar la ventana negra abierta** mientras quieras acceso remoto

### En tu notebook

Agregar a `~/.ssh/config`:

```text
Host ecopos ecopos-win7
    HostName 127.0.0.1
    User Ecopos
    Port 9022
    ProxyJump Agencia_dev-VPS-NEW
    ConnectTimeout 15
```

Conectar:

```powershell
ssh ecopos
# o
powershell -File scripts\ssh-ecopos.ps1
```

Copiar archivos:

```powershell
scp -J Agencia_dev-VPS-NEW -P 9022 ".\Archivo.zip" Ecopos@127.0.0.1:C:\ARCHIVOS_GO\
```

## Datos del cliente

| Campo | Valor |
|-------|--------|
| Usuario Windows | Ecopos |
| IP local | 192.168.0.15 |
| AnyDesk | 401 688 203 |
| Bitvise | puerto 22 local |
