const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CREACIÓN AUTOMÁTICA DE CARPETA TEMPORAL
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
    console.log("✅ Carpeta 'temp' creada");
}

app.get('/download', async (req, res) => {
    const { v, start, end } = req.query;

    if (!v || !start || !end) {
        return res.status(400).send("Faltan parámetros: v, start o end.");
    }

    // 2. BYPASS DE API EXTERNA (y2down/savenow)
    // Usamos el ID del video y la API key que capturamos
    const youtubeUrl = `https://www.youtube.com/watch?v=${v}`;
    const apiUrl = `https://p.savenow.to/ajax/download.php?copyright=0&format=720&url=${encodeURIComponent(youtubeUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

    console.log(`[LOG] Procesando video: ${v}`);

    try {
        // Pedimos el link directo para que YouTube no vea la IP de Railway
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': '*/*',
                'referer': 'https://y2down.cc/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const videoDirectUrl = response.data.url;

        if (!videoDirectUrl) {
            console.error("Respuesta API sin URL:", response.data);
            return res.status(500).send("La API externa no devolvió un link de descarga.");
        }

        const duration = parseFloat(end) - parseFloat(start);
        const fileName = `clip_${Date.now()}.mp4`;
        const outputPath = path.join(tempDir, fileName);

        // 3. RECORTE CON FFMEG USANDO EL LINK DIRECTO
        // Usamos -ss antes del -i para que sea mucho más rápido
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${videoDirectUrl}" -c:v libx264 -preset superfast -crf 28 -c:a copy "${outputPath}"`;

        console.log(`[FFMPEG] Ejecutando: ${ffmpegCmd}`);

        exec(ffmpegCmd, (err) => {
            if (err) {
                console.error("Error FFmpeg:", err);
                return res.status(500).send("Error al procesar el clip con FFmpeg.");
            }

            // Enviamos el archivo y luego lo borramos para no llenar el disco de Railway
            res.download(outputPath, (downloadErr) => {
                if (!downloadErr) {
                    fs.unlinkSync(outputPath); 
                    console.log(`[OK] Clip enviado y limpiado: ${fileName}`);
                }
            });
        });

    } catch (error) {
        console.error("Error en el Bypass:", error.message);
        res.status(500).send("Fallo la conexión con el motor de descarga externo.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Motor corriendo en puerto ${PORT}`);
});
