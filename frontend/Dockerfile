FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . ./
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# copy custom nginx config to listen on 7777
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 7777
CMD ["nginx", "-g", "daemon off;"]
