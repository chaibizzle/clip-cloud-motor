const axios = require('axios');

app.get('/download', async (req, res) => {
    const { v, start, end } = req.query;
    
    // El secreto que sacamos de y2down
    const apiUrl = `https://p.savenow.to/ajax/download.php?copyright=0&format=720&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${v}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

    try {
        // Le pedimos el link directo a la API externa
        const response = await axios.get(apiUrl, {
            headers: { 'referer': 'https://y2down.cc/' }
        });

        const videoDirectUrl = response.data.url; // Este es el link al .mp4 real

        if (!videoDirectUrl) return res.send("Error: No se obtuvo el link del video.");

        const duration = parseFloat(end) - parseFloat(start);
        const fileName = `clip_${Date.now()}.mp4`;

        // FFmpeg hace el recorte usando el link directo
        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${videoDirectUrl}" -c:v libx264 -preset superfast -crf 28 "temp/${fileName}"`;

        exec(ffmpegCmd, (err) => {
            if (err) return res.send("Error al recortar.");
            res.download(`temp/${fileName}`);
        });

    } catch (e) {
        res.send("Fallo la conexión con el bypass.");
    }
});
