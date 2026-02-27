export interface AudioData {
    low: number
    mid: number
    high: number
    all: number
    sub: number    // Added sub-bass (20-60Hz)
    peak: number   // Fast response peak for kick detection
}

export class AudioEngine {
    private context: AudioContext | null = null
    private analyser: AnalyserNode | null = null
    private dataArray: Uint8Array | null = null
    private microphoneStream: MediaStream | null = null
    private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null

    private smoothing: number = 0.25
    private smoothedData: AudioData = { low: 0, mid: 0, high: 0, all: 0, sub: 0, peak: 0 }

    private baselineTime: number = 0

    constructor() {
        // We don't initialize context here to avoid browser autoplay blocks.
        // Init must be triggered by user interaction.
    }

    public get isMicrophoneActive(): boolean {
        return !!this.microphoneStream
    }

    public stopMicrophone() {
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop())
            this.microphoneStream = null
        }
    }

    public initFromElement(audioElement: HTMLAudioElement) {
        if (!this.context) {
            this.context = new AudioContext()
        }

        // Se l'analyser non esiste, lo creiamo
        if (!this.analyser) {
            this.analyser = this.context.createAnalyser()
            this.analyser.fftSize = 2048
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
        }

        // Prima di connettere la nuova sorgente, disconnettiamo quella vecchia se esiste
        if (this.source) {
            this.source.disconnect()
        }

        // Creiamo la sorgente dall'elemento audio e la connettiamo
        this.source = this.context.createMediaElementSource(audioElement)
        this.source.connect(this.analyser)
        this.analyser.connect(this.context.destination)

        // Se il context era sospeso, lo riprendiamo
        if (this.context.state === 'suspended') {
            this.context.resume()
        }
        console.log('Audio initialized from element successfully')
    }

    public async init(): Promise<void> {
        try {
            if (!this.context) {
                this.context = new AudioContext()
            }
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })

            if (!this.analyser) {
                this.analyser = this.context.createAnalyser()
                this.analyser.fftSize = 2048
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
            }

            if (this.source) {
                // disconnect previous source if any
                this.source.disconnect()
            }

            this.source = this.context.createMediaStreamSource(this.microphoneStream)
            this.source.connect(this.analyser)
            console.log('Audio initialized successfully')
        } catch (err) {
            console.error('Failed to initialize audio:', err)
            throw err
        }
    }

    public update(dt: number): AudioData {
        if (!this.analyser || !this.dataArray) {
            // Idle Baseline Behavior
            this.baselineTime += dt
            const pulse = (Math.sin(this.baselineTime * 0.5) * 0.5 + 0.5) * 0.2
            this.smoothedData = {
                low: pulse,
                mid: pulse * 0.5,
                high: pulse * 0.2,
                all: pulse,
                sub: pulse * 1.2,
                peak: pulse
            }
            return this.smoothedData
        }

        this.analyser.getByteFrequencyData(this.dataArray as any)

        // Band extraction
        let low = 0, mid = 0, high = 0
        const binCount = this.analyser.frequencyBinCount

        // Low: 40 - 120 Hz (Tight punchy bass)
        const lowStart = Math.floor(binCount * (40 / 22050))
        const lowEnd = Math.floor(binCount * (120 / 22050))
        for (let i = lowStart; i < lowEnd; i++) low += this.dataArray[i]
        low /= (lowEnd - lowStart || 1)

        // Sub: 20 - 60 Hz (Deep rumble)
        let sub = 0
        const subEnd = Math.floor(binCount * (60 / 22050))
        for (let i = 0; i < subEnd; i++) sub += this.dataArray[i]
        sub /= (subEnd || 1)

        // Mid: 250 - 2500 Hz
        const midStart = Math.floor(binCount * (250 / 22050))
        const midEnd = Math.floor(binCount * (2500 / 22050))
        for (let i = midStart; i < midEnd; i++) mid += this.dataArray[i]
        mid /= (midEnd - midStart || 1)

        // High: 4000 - 12000 Hz
        const highStart = Math.floor(binCount * (4000 / 22050))
        const highEnd = Math.floor(binCount * (12000 / 22050))
        for (let i = highStart; i < highEnd; i++) high += this.dataArray[i]
        high /= (highEnd - highStart || 1)

        const target: AudioData = {
            low: low / 255,
            sub: sub / 255,
            mid: mid / 255,
            high: high / 255,
            all: (low + mid + high) / (3 * 255),
            peak: 0 // calculated below
        }

        // Peak detector (Fast attack, slow decay)
        const instantLow = target.low
        this.smoothedData.peak = Math.max(instantLow, this.smoothedData.peak * 0.95)
        target.peak = this.smoothedData.peak

        // IIR Smoothing
        this.smoothedData.low += (target.low - this.smoothedData.low) * this.smoothing
        this.smoothedData.sub += (target.sub - this.smoothedData.sub) * this.smoothing
        this.smoothedData.mid += (target.mid - this.smoothedData.mid) * this.smoothing
        this.smoothedData.high += (target.high - this.smoothedData.high) * this.smoothing
        this.smoothedData.all += (target.all - this.smoothedData.all) * this.smoothing

        return this.smoothedData
    }

    public async toggle(): Promise<boolean> {
        if (!this.context) {
            await this.init()
            return true
        }

        if (this.context.state === 'running') {
            await this.context.suspend()
            return false
        } else {
            await this.context.resume()
            return true
        }
    }

    public setSmoothing(value: number) {
        this.smoothing = Math.max(0.01, Math.min(0.5, value))
    }

    public get isReady(): boolean {
        return !!this.analyser
    }
}
