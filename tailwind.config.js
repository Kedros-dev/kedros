/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F134E",
        midnight: "#13011B",
        violet: "#642DD4",
        cloud: "#F8FAFB",
        slate: "#656989",
        mist: "#CAD4E1"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "ui-sans-serif", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 19, 78, 0.08)",
        violet: "0 18px 45px rgba(100, 45, 212, 0.24)"
      }
    }
  },
  plugins: []
};