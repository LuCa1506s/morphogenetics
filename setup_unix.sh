#!/bin/bash

# Morphogenetic Particle System - Automated Setup (Unix/Linux/macOS)

echo "======================================================"
echo "  Morphogenetic Particle System - Automated Setup"
echo "======================================================"
echo

# 1. Check for Node.js
if ! command -v node &> /dev/null
then
    echo "[ERRORE] Node.js non è installato!"
    echo "Per favore, installalo (consigliato l'uso di NVM) prima di continuare."
    exit 1
fi

echo "[OK] Node.js rilevato: $(node -v)"
echo

# 2. Install dependencies
echo "[INFO] Installazione delle dipendenze in corso (npm install)..."
npm install

if [ $? -ne 0 ]; then
    echo
    echo "[ERRORE] L'installazione delle dipendenze è fallita."
    exit 1
fi

echo
echo "[OK] Dipendenze installate con successo!"
echo
echo "======================================================"
echo "  INSTALLAZIONE COMPLETATA"
echo "======================================================"
echo
echo "Per avviare la simulazione:"
echo "1. Digita: npm run dev"
echo "2. Apri il browser su: http://localhost:5173"
echo

read -p "Vuoi avviare la simulazione adesso? (s/n): " choice
case "$choice" in 
  s|S ) npm run dev;;
  * ) echo "Puoi chiudere questo terminale.";;
esac
