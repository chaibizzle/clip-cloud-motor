const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000; // Ajustado para Railway

app.use(cors());

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

app.get('/download', (req, res) => {
    const videoId = req.query.v;
    const start = req.query.start;
    const end = req.query.end;

    if (!videoId || !start || !end) return res.status(400).send('Faltan datos');

    const duration = parseFloat(end) - parseFloat(start);
    const fileName = `clip_${videoId}_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    console.log(`[LOG] Procesando clip de: ${videoId} (${start}s a ${end}s)`);

    // ESTRATEGIA SIN COOKIES: Usamos un User-Agent de Android y el cliente web para evitar bloqueos
    // Se eliminó el parámetro --cookies para evitar errores si el archivo no está
    const getUrl = `yt-dlp --user-agent "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36" --force-ipv4 --no-check-certificate --extractor-args "youtube:player_client=android,web" -g -f "best" "https://www.youtube.com/watch?v=${videoId}"`;

    exec(getUrl, (err, stdout) => {
        if (err) {
            console.error(`[ERROR yt-dlp]: ${err}`);
            return res.status(500).send("Error al obtener el video. YouTube bloqueó la conexión del servidor.");
        }

        const urls = stdout.split('\n').filter(l => l.trim() !== "");
        if (urls.length === 0) return res.status(500).send("No se pudieron obtener las URLs de descarga.");

        const vUrl = urls[0].trim();
        const aUrl = urls[1] ? urls[1].trim() : vUrl;

        // FFmpeg procesa los streams directamente desde los servidores de Google
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${vUrl}" -ss ${start} -t ${duration} -i "${aUrl}" -map 0:v -map 1:a? -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) {
                console.error(`[ERROR FFmpeg]: ${ffErr}`);
                return res.status(500).send("Error al procesar el video con FFmpeg.");
            }
            
            res.download(outputPath, fileName, () => {
                // Limpieza del archivo temporal después de la descarga
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch(e) { console.error("Error al borrar temp:", e); }
                    }
                }, 15000);
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Motor activo en puerto ${PORT}`);
    console.log("Modo: Sin cookies (Estrategia de cliente Android)");
});
