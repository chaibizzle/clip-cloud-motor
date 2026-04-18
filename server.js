const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 7860;

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
    const cookiePath = path.join(__dirname, 'youtube.com_cookies.txt');

    console.log(`[LOG] Iniciando descarga para: ${videoId}`);

    // VERIFICACIÓN DE COOKIES
    if (!fs.existsSync(cookiePath)) {
        console.error(`[ERROR] No se encuentra el archivo: ${cookiePath}`);
        return res.status(500).send("Error: El archivo de cookies no existe en el servidor.");
    }

    // COMANDO CON COOKIES Y AGENTE DE NAVEGADOR REAL
    const getUrl = `yt-dlp --cookies "${cookiePath}" --user-agent "com.google.android.youtube/19.05.36 (Linux; U; Android 14; es_US; Pixel 8 Pro) gzip" --force-ipv4 --no-check-certificate --extractor-args "youtube:player_client=android" -g -f "best" "https://www.youtube.com/watch?v=${videoId}"`;
    exec(getUrl, (err, stdout) => {
        if (err) {
            console.error(`[ERROR yt-dlp]: ${err}`);
            return res.status(500).send("YouTube rechazó las cookies o la IP. Intentá generar cookies nuevas.");
        }

        const urls = stdout.split('\n').filter(l => l.trim() !== "");
        const vUrl = urls[0].trim();
        const aUrl = urls[1] ? urls[1].trim() : vUrl;

        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${vUrl}" -ss ${start} -t ${duration} -i "${aUrl}" -map 0:v -map 1:a? -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) return res.status(500).send("Error al procesar el video con FFmpeg.");
            
            res.download(outputPath, fileName, () => {
                if (fs.existsSync(outputPath)) {
                    setTimeout(() => {
                        try { fs.unlinkSync(outputPath); } catch(e) {}
                    }, 10000);
                }
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Motor activo en puerto ${PORT}`);
    console.log(`Buscando cookies en: ${path.join(__dirname, 'youtube.com_cookies.txt')}`);
});
