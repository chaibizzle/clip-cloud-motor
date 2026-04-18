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
    const fileName = `clip_${videoId}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    // Bypass usando cliente de Android/TV
    const getUrl = `yt-dlp --force-ipv4 --no-check-certificate --extractor-args "youtube:player_client=android,tv" -g -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "https://www.youtube.com/watch?v=${videoId}"`;

    exec(getUrl, (err, stdout) => {
        if (err) return res.status(500).send("Error de IP en Render");

        const urls = stdout.split('\n').filter(l => l.trim() !== "");
        const vUrl = urls[0].trim();
        const aUrl = urls[1] ? urls[1].trim() : vUrl;

        const ffmpegCmd = `ffmpeg -ss ${start} -t ${duration} -i "${vUrl}" -ss ${start} -t ${duration} -i "${aUrl}" -map 0:v -map 1:a? -c:v libx264 -preset superfast -crf 26 -c:a aac "${outputPath}"`;

        exec(ffmpegCmd, (ffErr) => {
            if (ffErr) return res.status(500).send("Error FFmpeg");
            res.download(outputPath, fileName, () => {
                if (fs.existsSync(outputPath)) setTimeout(() => fs.unlinkSync(outputPath), 5000);
            });
        });
    });
});

app.listen(PORT, () => console.log(`Online en puerto ${PORT}`));
