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

app.get('/download', async (req, res) => {
    const videoId = req.query.v;
    const start = req.query.start;
    const end = req.query.end;

    if (!videoId || !start || !end) return res.status(400).send('Faltan datos');

    const duration = parseFloat(end) - parseFloat(start);
    const fileName = `clip_${videoId}_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    console.log(`[LOG] Solicitando video a Cobalt: ${videoId}`);

    try {
        // Usamos fetch (nativo) para no necesitar librerías extra
        const response = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: `https://www.youtube.com/watch?v=${videoId}`,
                videoQuality: '720',
                downloadMode: 'tunnel'
            })
        });

        const data = await response.json();
        
        if (!data || !data.url) {
            console.error("[ERROR] Respuesta de Cobalt sin URL:", data);
            return res.status(500).send("YouTube bloqueó el túnel. Reintentá en 10 segundos.");
        }

        const directUrl = data.url;
        console.log(`[LOG] Recortando con FFmpeg...`);

        // Recorte directo desde el stream de Cobalt
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${directUrl}" -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) {
                console.error(`[ERROR FFmpeg]: ${ffErr}`);
                return res.status(500).send("Error al procesar el clip.");
            }
            
            res.download(outputPath, fileName, () => {
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch(e) {}
                    }
                }, 15000);
            });
        });

    } catch (error) {
        console.error(`[ERROR]:`, error.message);
        res.status(500).send("Error de conexión con el motor principal.");
    }
});

app.listen(PORT, () => {
    console.log(`Motor Clip Cloud Online en puerto ${PORT}`);
});
