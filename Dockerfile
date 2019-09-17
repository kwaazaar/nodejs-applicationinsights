FROM node:buster-slim
RUN apt-get update && apt-get install dnsutils -y
WORKDIR /app
ADD package.json .
RUN npm install --production
ADD run.js .
ENTRYPOINT ["docker-entrypoint.sh", "run.js"]
