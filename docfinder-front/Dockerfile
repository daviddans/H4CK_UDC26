FROM node:22-alpine

RUN mkdir node

COPY . ./node

WORKDIR ./node/

RUN npm install

CMD ["npm", "run", "dev"]
