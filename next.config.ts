// /next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "http://192.168.11.3:3000",
    "http://localhost:3000",
  ],
};

module.exports = nextConfig;