FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

# Use yarn install for clean installs
RUN yarn install --frozen-lockfile

COPY . .

# Build TypeScript files
RUN yarn build

EXPOSE 8000

# Use 'start' for production deployment
CMD ["yarn", "start"]