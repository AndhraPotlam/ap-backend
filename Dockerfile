FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Add this command to build TypeScript files
RUN npm run build

EXPOSE 8000

# Use only one CMD instruction
CMD ["npm", "run", "dev"]