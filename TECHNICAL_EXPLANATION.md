# Morphogenetic Audio-Reactive Particle System: Spiegazione Tecnica e Matematica

Questo documento descrive i fondamenti matematici e l'architettura tecnica del sistema di particelle morfogenetico. Il progetto utilizza calcoli GPGPU (General-Purpose computing on Graphics Processing Units) per simulare migliaia di particelle in tempo reale, sincronizzandole con l'input audio.

## 1. Architettura di Sistema

L'applicazione è costruita su tre pilastri principali:
- **Web Audio API**: Gestisce l'acquisizione del segnale dal microfono e l'analisi spettrale.
- **Three.js**: Fornisce l'interfaccia con WebGL per il rendering e la gestione dei buffer GPGPU.
- **GLSL Shaders**: Il cuore pulsante del sistema, dove avvengono le simulazioni fisiche direttamente sulla GPU.

## 2. Analisi Spettrale dell'Audio

L'audio viene analizzato in tempo reale tramite un `AnalyserNode`. Le frequenze vengono divise in bande specifiche per controllare diversi aspetti del sistema:
- **Sub-Bass (20-60Hz)**: Controlla le vibrazioni strutturali e le distorsioni a bassa frequenza.
- **Low (40-120Hz)**: Mappa il "kick" e controlla le espansioni radiali improvvise.
- **Mid (250-2500Hz)**: Influenza la morfologia superficiale (warp) e le deformazioni strutturali.
- **High (4000-12000Hz)**: Controlla il rumore di turbolenza (Curl Noise) e i dettagli microscopici.

### 2.1 Smoothing e Peak Detection
Per garantire una risposta fluida e reattiva, l'elaborazione del segnale segue questi passaggi:

**Smoothing Temporale (IIR Filter)**
Per evitare jitter e variazioni brusche:
$$S_t = \alpha X_t + (1 - \alpha) S_{t-1}$$
con $\alpha \in [0.05, 0.2]$.

**Envelope Follower (Fast Attack / Slow Decay)**
Cattura l'andamento energetico del segnale (Peak Envelope):
$$E_t = \begin{cases} A X_t + (1 - A) E_{t-1} & \text{se } X_t > E_{t-1} \\ D X_t + (1 - D) E_{t-1} & \text{altrimenti} \end{cases}$$
con:
- $A \gg D$
- $A \approx 0.6 - 0.9$ (Attack rapido)
- $D \approx 0.01 - 0.1$ (Decay lento)

## 3. Fondamenti Matematici della Simulazione

### 3.1 Integrazione Numerica
Il sistema utilizza uno schema di integrazione **Semi-Implicit Euler**. In ogni frame ($dt$):
1. Si calcola la nuova velocità: $v_{t+dt} = v_t + a \cdot dt$
2. Si calcola la nuova posizione: $x_{t+dt} = x_t + v_{t+dt} \cdot dt$

#### 3.1.1 Modello Dinamico Completo delle Forze
La dinamica di ciascuna particella è governata dalla somma delle forze:
$$\mathbf{F}_{total} = \mathbf{F}_{harmonic} + \mathbf{F}_{damping} + \mathbf{F}_{vortex} + \mathbf{F}_{noise} + \mathbf{F}_{audio} + \mathbf{F}_{surface} + \mathbf{F}_{field}$$

Dove:
- **Harmonic Restoring Force**: $\mathbf{F}_{harmonic} = -k(t)\mathbf{x}$. Forza elastica globale verso l'origine.
- **Damping**: $\mathbf{F}_{damping} = -\gamma \mathbf{v}$. Dissipazione energetica per prevenire divergenze numeriche.
- **Vortex Field**: $\mathbf{F}_{vortex} = \omega \times \mathbf{x}$. Introduce rotazione globale controllata.
- **Surface Constraint**: $\mathbf{F}_{surface} = -\alpha (\mathbf{x} - \mathbf{x}_{target})$ dove $\mathbf{x}_{target} = \Phi(\theta, \phi, t, audio)$.
- **Implicit Field Force**: $\mathbf{F}_{field} = -\beta \nabla S$ (Vedi Sezione 3.3).
- **Curl Noise**: $\mathbf{F}_{noise} = \nabla \times \mathbf{P}$ (Vedi Sezione 3.4).
- **Audio Impulse**: $\mathbf{F}_{audio}$ rappresenta l'espansione radiale basata sui picchi energetici.

L'accelerazione risultante è: $\mathbf{a} = \mathbf{F}_{total}$.

### 3.2 Morfogenesi Toroide
Le particelle sono attratte verso una superficie toroidale dinamica:
$$X(\theta, \phi) = (R + r \cos\phi) \cos\theta$$
$$Y(\theta, \phi) = (R + r \cos\phi) \sin\theta$$
$$Z(\theta, \phi) = r \sin\phi$$

### 3.3 Campo Implicito (S-Field) e Gradienti
Per un toroide:
$$S(x,y,z) = (x^2 + y^2 + z^2 + R^2 - r^2)^2 - 4R^2(x^2 + y^2) = 0$$

### 3.4 Turbolenza: Curl Noise
Derivato dal rotore di un campo potenziale: $\mathbf{v}_{curl} = \nabla \times \mathbf{P}$.

### 3.5 Stabilità Numerica e Controllo Energetico
**Fixed Timestep**
La simulazione utilizza un timestep fisso $dt = 1/60$ con accumulatore temporale per disaccoppiare simulazione e rendering.

**Gradient Stabilization**
Per evitare instabilità durante variazioni rapide di $R(t)$ o $r(t)$:
Soft Normalization del gradiente:
$$\mathbf{F}_{field} = -\beta \frac{\nabla S}{|\nabla S| + \epsilon}$$
dove $\epsilon$ previene divisioni per zero e limita l'amplificazione del campo.

**Velocity Clamping**
Per prevenire "floating point explosions": $|\mathbf{v}| \le v_{max}$.

**Condizione di Stabilità**
Per il vincolo elastico: $\alpha dt^2 < 1$.

## 4. Struttura della Memoria GPU

Il sistema utilizza texture floating point RGBA per memorizzare lo stato delle particelle.

**Position Texture**
- **RGB**: Coordinate world-space (x, y, z)
- **A**: Energia normalizzata [0, 1]

**Velocity Texture**
- **RGB**: Velocità (vx, vy, vz)
- **A**: Intensità reattiva locale / densità

**Parametric Texture**
- **R**: $\theta$
- **G**: $\phi$
- **B**: Random seed / particle ID
- **A**: Riservato

Tutte le texture sono in formato **RGBA32F** (primario) o **RGBA16F** (fallback mobile).

## 5. Sequenza di Frame (Lifecycle)

L'ordine di esecuzione deterministico per frame è:
1. **Aggiornamento Audio**: FFT + smoothing + envelope calculation.
2. **Sincronizzazione Uniform**: Invio dei dati audio e parametri agli shader.
3. **Accumulator Update**: Gestione del tempo per il fixed timestep.
4. **Simulation Pass 1 (Velocity)**: Calcolo accelerazioni e aggiornamento $v$.
5. **Ping-Pong Swap**: Scambio dei buffer di velocità.
6. **Simulation Pass 2 (Position)**: Aggiornamento $x$ basato su $v$ aggiornata.
7. **Ping-Pong Swap**: Scambio dei buffer di posizione.
8. **Render Pass**: Visualizzazione delle particelle basata sulle texture finali.

---
*Creato per il progetto Morphogenetic Audio-Reactive Particle System.*
