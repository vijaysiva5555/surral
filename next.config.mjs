/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  serverExternalPackages: ["exceljs", "mongoose", "@react-pdf/renderer"],
  turbopack: { root: import.meta.dirname },   // this folder is the project root (a stray package-lock.json higher up is ignored)
};
