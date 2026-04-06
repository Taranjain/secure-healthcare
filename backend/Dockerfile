FROM node:20-alpine

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run seed && npm start"]
