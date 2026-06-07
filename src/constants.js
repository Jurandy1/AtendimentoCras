export const APP_ID = "cras-atendimento-default";

export const COR_PRINCIPAL = "#1351B4";
export const COR_PRINCIPAL_HOVER = "#104191";
export const CORES_STATUS = { 
  aguardando: "bg-yellow-100 text-yellow-800 border-yellow-300", 
  chamando: "bg-blue-100 text-blue-800 border-blue-300", 
  em_atendimento: "bg-green-100 text-green-800 border-green-300", 
  finalizado: "bg-gray-100 text-gray-700 border-gray-300" 
};
export const CORES_TIPO_PADRAO = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#D81B60', '#00ACC1', '#FB8C00'];

export const GOOGLE_SHEETS_WEBAPP_URL =
  import.meta.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || "";

export const GOOGLE_SHEETS_TOKEN =
  import.meta.env.VITE_GOOGLE_SHEETS_TOKEN || "";
