FROM node:alpine
WORKDIR /app
ADD package.json .
RUN npm install --production
ADD run.js .
ENTRYPOINT ["docker-entrypoint.sh", "run.js"]
