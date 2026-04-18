FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl && ln -s /usr/bin/python3 /usr/bin/python && rm -rf /var/lib/apt/lists/*
RUN pip3 install -U yt-dlp --break-system-packages
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN mkdir -p temp && chmod 777 temp
EXPOSE 7860
CMD ["node", "server.js"]
