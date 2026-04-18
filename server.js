const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // Asegurate de tener axios instalado: npm install axios

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

    console.log(`[LOG] Solicitando link premium para: ${videoId}`);

    try {
        // Usamos la API de Cobalt para obtener el stream directo sin bloqueos de IP
        const response = await axios.post('https://api.cobalt.tools/api/json', {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoQuality: '720', // Calidad balanceada para que el recorte sea rápido
            downloadMode: 'tunnel' 
        }, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
        });

        if (!response.data || !response.data.url) {
            throw new Error("No se obtuvo URL de Cobalt");
        }

        const directUrl = response.data.url;
        console.log(`[LOG] Stream obtenido. Empezando recorte con FFmpeg...`);

        // Al tener el stream directo de Cobalt, FFmpeg puede recortar sin que YouTube se entere
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${directUrl}" -c:v libx264 -preset superfast -crf 28 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) {
                console.error(`[ERROR FFmpeg]: ${ffErr}`);
                return res.status(500).send("Error al procesar el recorte.");
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
        console.error(`[ERROR API]:`, error.message);
        res.status(500).send("El motor de descarga está bajo mantenimiento. Intentá en un momento.");
    }
});

app.listen(PORT, () => {
    console.log(`Motor Clip Cloud (Cobalt Engine) activo en puerto ${PORT}`);
});
