FROM node:22-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --omit=dev nodemailer@7 web-push@3 && mkdir -p /data
COPY server.mjs /app/server.mjs
ENV NODE_ENV=production PORT=3000 LEADS_FILE=/data/leads.jsonl
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "/app/server.mjs"]
