import React, { useState, useEffect } from "react";

function formatarDataInstitucional(data) {
  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  const diaMes = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const texto = `${diaSemana}, ${diaMes}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function PainelTVRelogio() {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const horaTexto = agora.toLocaleTimeString("pt-BR", { hour12: false }).substring(0, 5);
  const dataTexto = formatarDataInstitucional(agora);

  return (
    <div className="painel-tv__relogio" aria-label={`Data e hora: ${dataTexto}, ${horaTexto}`}>
      <div className="painel-tv__relogio-painel">
        <time className="painel-tv__relogio-conteudo" dateTime={agora.toISOString()}>
          <span className="painel-tv__relogio-data">{dataTexto}</span>
          <span className="painel-tv__relogio-hora">{horaTexto}</span>
        </time>
      </div>
    </div>
  );
}

export default React.memo(PainelTVRelogio);
