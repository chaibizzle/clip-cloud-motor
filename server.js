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

app.get('/download', (req, res) => {
    const videoId = req.query.v;
    const start = req.query.start;
    const end = req.query.end;

    if (!videoId || !start || !end) return res.status(400).send('Faltan datos');

    const duration = parseFloat(end) - parseFloat(start);
    const fileName = `clip_${videoId}_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    console.log(`[LOG] Intentando clip de: ${videoId} vía PROXY`);

    // LISTA DE PROXIES (Si uno falla, probamos el siguiente)
    // Formato: http://IP:PUERTO
    const proxies = [
        "http://43.134.34.110:3128",
        "http://103.174.102.5:8080",
        "http://157.245.155.156:80",
        "http://188.166.162.2:3128"
    ];
    
    // Usamos el primero de la lista (podés cambiar el índice 0 por 1, 2, etc.)
    const activeProxy = proxies[0];

    // COMANDO CON PROXY Y USER AGENT
    // --proxy le dice a yt-dlp que use una IP distinta
    const getUrl = `yt-dlp --proxy "${activeProxy}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" --force-ipv4 --no-check-certificate -g -f "best" "https://www.youtube.com/watch?v=${videoId}"`;

    exec(getUrl, (err, stdout) => {
        if (err) {
            console.error(`[ERROR yt-dlp con Proxy]: ${err}`);
            return res.status(500).send("El Proxy falló o YouTube lo detectó. Probá cambiando la IP del proxy en server.js");
        }

        const urls = stdout.split('\n').filter(l => l.trim() !== "");
        if (urls.length === 0) return res.status(500).send("No se obtuvieron URLs.");

        const vUrl = urls[0].trim();
        const aUrl = urls[1] ? urls[1].trim() : vUrl;

        // FFmpeg no necesita el proxy porque ya tiene el link directo de los servidores de Google (vUrl)
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${vUrl}" -ss ${start} -t ${duration} -i "${aUrl}" -map 0:v -map 1:a? -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) {
                console.error(`[ERROR FFmpeg]: ${ffErr}`);
                return res.status(500).send("Error en el procesado final del clip.");
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
    console.log(`Motor con Proxy activo en puerto ${PORT}`);
});
