const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Lista de instancias espejo confiables
const instances = [
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://invidious.flokinet.to"
];

app.get('/download', (req, res) => {
    const videoId = req.query.v;
    const start = req.query.start;
    const end = req.query.end;

    if (!videoId || !start || !end) return res.status(400).send('Faltan datos');

    const duration = parseFloat(end) - parseFloat(start);
    const fileName = `clip_${videoId}_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    // Elegimos una instancia aleatoria para no saturar
    const randomInstance = instances[Math.floor(Math.random() * instances.length)];
    
    console.log(`[LOG] Usando puente: ${randomInstance} para video: ${videoId}`);

    // Comando optimizado: sin cookies, sin proxy lento, usando el puente espejo
    const getUrl = `yt-dlp --no-check-certificate -g -f "best" "${randomInstance}/watch?v=${videoId}"`;

    exec(getUrl, (err, stdout) => {
        if (err) {
            console.error(`[ERROR yt-dlp]: ${err}`);
            return res.status(500).send("El servidor puente está saturado. Reintentá en unos segundos.");
        }

        const urls = stdout.split('\n').filter(l => l.trim() !== "");
        if (urls.length === 0) return res.status(500).send("No se pudo obtener la ruta del video.");

        const vUrl = urls[0].trim();
        const aUrl = urls[1] ? urls[1].trim() : vUrl;

        // FFmpeg procesa el recorte
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${vUrl}" -ss ${start} -t ${duration} -i "${aUrl}" -map 0:v -map 1:a? -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) {
                console.error(`[ERROR FFmpeg]: ${ffErr}`);
                return res.status(500).send("Error al procesar el clip con FFmpeg.");
            }
            
            res.download(outputPath, fileName, () => {
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch(e) {}
                    }
                }, 15000);
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Motor de Clips activo en puerto ${PORT}`);
    console.log(`Modo: Puente Espejo (Invidious Network)`);
});
