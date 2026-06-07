module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Raleway'", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#1351B4",
          hover: "#104191",
          dark: "#0D47A1",
        },
        govbr: {
          azul: "#1351B4",
          "azul-escuro": "#0D47A1",
          fundo: "#F5F5F5",
          borda: "#E0E0E0",
          texto: "#1F2937",
          "texto-secundario": "#6B7280",
        },
        status: {
          aguardando: "#F59E0B",
          chamando: "#2563EB",
          em_atendimento: "#16A34A",
          finalizado: "#374151",
          ausente: "#EA580C",
          cancelado: "#DC2626",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,.06)",
      },
      borderRadius: {
        xl: "0.9rem",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
      }
    }
  },
  corePlugins: {
    preflight: false,
  },
  plugins: []
};

