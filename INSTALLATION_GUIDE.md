# INSTALLATION GUIDE - Morphogenetic Particle System

Questo documento spiega come configurare l'ambiente di sviluppo e far girare la simulazione sui principali sistemi operativi.

## Requisiti Minimi
- **Node.js**: versione 18.0.0 o superiore.
- **NPM**: incluso con Node.js.
- **Browser**: Chrome, Edge o Firefox (che supportino WebGL2).

---

## 1. WINDOWS (Desktop)

### Opzione A: Installer Diretto
1. Scarica l'installer `.msi` (LTS) da [nodejs.org](https://nodejs.org/).
2. Esegui l'installer e assicurati di selezionare "Add to PATH".
3. Apri il terminale (PowerShell o CMD) e verifica: `node -v`.

### Opzione B: NVM Windows (Consigliato per dev)
1. Scarica `nvm-setup.exe` da [nvm-windows](https://github.com/coreybutler/nvm-windows/releases).
2. Nel terminale:
   ```powershell
   nvm install 20
   nvm use 20
   ```

---

## 2. WINDOWS SERVER

L'installazione è simile alla versione Desktop, ma richiede attenzione alla sicurezza e all'accesso remoto.

1. Installa Node.js tramite l'installer `.msi`.
2. **Configurazione Firewall**:
   - Apri "Windows Defender Firewall with Advanced Security".
   - Crea una **Inbound Rule** per permettere il traffico sulla porta **5173** (TCP).
3. **Esecuzione in Rete**:
   - Per accedere al server da altri PC, avvia il progetto con:
     ```powershell
     npm run dev -- --host
     ```

---

## 3. LINUX (Ubuntu, Debian, CentOS)

Si consiglia l'uso di **NVM** per evitare problemi di permessi con `sudo`.

### Installazione NVM e Node
```bash
# Scarica nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carica nvm nel terminale attuale
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Installa Node
nvm install 20
node -v
```

### Installazione Progetto
```bash
git clone <url-del-progetto>
cd Morphogenetic_Audio-Reactive_Particle_System
npm install
npm run dev
```

---

## 4. MAC OS

### Opzione A: Homebrew
```bash
brew install node
```

### Opzione B: NVM
1. Installa NVM tramite il comando [curl indicato qui](https://github.com/nvm-sh/nvm).
2. Carica NVM nel tuo `.zshrc` o `.bash_profile`.
3. Installa Node: `nvm install 20`.

---

## COMANDI UNIVERSALI (Tutti i Sistemi)

Una volta installato Node.js e scaricato il codice, i comandi sono identici ovunque:

1.  **Installazione dipendenze**:
    ```bash
    npm install
    ```

2.  **Avvio ambiente sviluppo (Vite)**:
    ```bash
    npm run dev
    ```

3.  **Compilazione per produzione (Build)**:
    ```bash
    npm run build
    ```

---

## Risoluzione Problemi Comuni
- **Errore WebGL2**: Assicurati che i driver della scheda video siano aggiornati. Su sistemi virtualizzati (molti Windows Server), WebGL potrebbe non funzionare se non è presente una GPU fisica o un layer di emulazione.
- **Porta occupata**: Se la porta 5173 è occupata, Vite userà automaticamente la 5174.
