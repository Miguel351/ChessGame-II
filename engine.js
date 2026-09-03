// Stockfish (lite, tek-thread) Web Worker sarmalayıcısı.
// Worker oluşturulamazsa veya motor yanıt vermezse `available=false` olur; uygulama nötr (gri) işaretlemeye geri döner.
class StockfishEngine {
  constructor(scriptPath) {
    this.available = true;
    this.queue = Promise.resolve(null);
    try {
      this.worker = new Worker(scriptPath);
    } catch (err) {
      console.warn('Stockfish worker başlatılamadı, hamle değerlendirmesi devre dışı:', err);
      this.available = false;
      this.ready = Promise.resolve();
      return;
    }
    this.worker.onerror = (err) => {
      console.warn('Stockfish worker hatası, hamle değerlendirmesi devre dışı:', err);
      this.available = false;
    };
    this.ready = this._initUci();
  }

  _initUci() {
    return new Promise((resolve) => {
      // İlk yüklemede ~7MB wasm derlemesi yavaş disklerde 3sn'yi aşabiliyor, bu yüzden pay bırakıldı.
      const timeoutId = setTimeout(() => {
        this.worker.removeEventListener('message', onMessage);
        console.warn('Stockfish motoru zaman aşımına uğradı, hamle değerlendirmesi devre dışı.');
        this.available = false;
        resolve();
      }, 10000);
      const onMessage = (e) => {
        const lines = String(e.data).split('\n');
        if (lines.some(l => l.trim() === 'readyok')) {
          clearTimeout(timeoutId);
          this.worker.removeEventListener('message', onMessage);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
    });
  }

  // Verilen FEN pozisyonunu değerlendirir; dönen skor FEN'deki sıradaki tarafın perspektifindedir.
  // Motor tek seferde tek istek işleyebildiği için çağrılar kuyruklanır (öncekiler bitmeden düşürülmez).
  evaluateFEN(fen, { movetime = 300 } = {}) {
    if (!this.available) return Promise.resolve(null);
    const run = async () => {
      await this.ready;
      if (!this.available) return null;
      return new Promise((resolve) => {
        let lastScore = null;
        const onMessage = (e) => {
          const lines = String(e.data).split('\n');
          for (const line of lines) {
            const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
            if (scoreMatch) {
              lastScore = scoreMatch[1] === 'mate'
                ? { mate: parseInt(scoreMatch[2], 10) }
                : { cp: parseInt(scoreMatch[2], 10) };
            }
            if (line.startsWith('bestmove')) {
              this.worker.removeEventListener('message', onMessage);
              resolve(lastScore);
              return;
            }
          }
        };
        this.worker.addEventListener('message', onMessage);
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go movetime ' + movetime);
      });
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
}

const stockfishEngine = (() => {
  try {
    return new StockfishEngine('engine/stockfish-18-lite-single.js');
  } catch (err) {
    console.warn('Stockfish motoru yüklenemedi:', err);
    return { available: false, evaluateFEN: async () => null };
  }
})();
