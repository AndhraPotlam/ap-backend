FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Build TypeScript files
RUN npm run build

EXPOSE 8000

# Use 'start' for production deployment
CMD ["npm", "run", "start"]