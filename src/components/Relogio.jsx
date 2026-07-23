import React, { useState, useEffect } from 'react';

const Relogio = React.memo(({ className = "" }) => {
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const horaTexto = hora.toLocaleTimeString("pt-BR", { hour12: false }).substring(0, 5);

  if (className) {
    return <time className={className} dateTime={hora.toISOString()}>{horaTexto}</time>;
  }

  return (
    <div className="text-white font-semibold bg-white/10 px-6 py-2 rounded-xl backdrop-blur-sm shadow-sm">
      {horaTexto}
    </div>
  );
});

export default Relogio;
