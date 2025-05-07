FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Use npm ci for production install
RUN npm ci

COPY . .

# Build TypeScript files
RUN npm run build

EXPOSE 8000

# Use 'start' for production deployment
CMD ["npm", "run", "start"]