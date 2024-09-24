FROM node:20 as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


FROM caddy:2-alpine


COPY --from=build /app/dist /usr/share/caddy/
