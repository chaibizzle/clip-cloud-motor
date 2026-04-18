const axios = require('axios'); // Asegurate de tener axios o usa fetch

app.get('/download', async (req, res) => {
    const videoId = req.query.v;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Usamos la API que "encontramos" de y2down
    const apiUrl = `https://p.savenow.to/ajax/download.php?copyright=0&format=720&url=${encodeURIComponent(youtubeUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

    try {
        console.log(`[LOG] Pidiendo video a la API externa para: ${videoId}`);
        
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': '*/*',
                'referer': 'https://y2down.cc/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
            }
        });

        // La API suele devolver un JSON con el link directo al .mp4
        const videoDirectUrl = response.data.url || response.data.link; 

        if (!videoDirectUrl) {
            return res.status(500).send("No se pudo obtener el link directo de la API externa.");
        }

        // Ahora que tenemos el link directo, FFmpeg lo procesa sin que YouTube bloquee a Render
        const fileName = `clip_${videoId}.mp4`;
        const outputPath = path.join(__dirname, 'temp', fileName);
        
        // El comando de FFmpeg ahora usa el link directo de la API
        const ffmpegCmd = `ffmpeg -ss ${req.query.start} -t ${parseFloat(req.query.end) - parseFloat(req.query.start)} -i "${videoDirectUrl}" -c:v libx264 -preset superfast -crf 28 "${outputPath}"`;

        exec(ffmpegCmd, (err) => {
            if (err) return res.status(500).send("Error al procesar el clip.");
            res.download(outputPath);
        });

    } catch (error) {
        console.error("Error conectando con la API externa:", error);
        res.status(500).send("La API externa rechazó la petición.");
    }
});
