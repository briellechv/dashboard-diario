import express from "express";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname));

// Rota que retorna os dados em JSON para a página web
app.get("/dados", async (req, res) => {
  try {
    const [clima, dolar, noticias, bitcoin] = await Promise.all([
      buscarClima(),
      buscarDolar(),
      buscarNoticias(),
      buscarBitcoin(),
    ]);
    res.json({ clima, dolar, noticias, bitcoin });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// ─── FUNÇÕES DE BUSCA ─────────────────────────────────
async function buscarClima() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=-1.45&longitude=-48.50&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FBelem";
  const res = await fetch(url);
  const data = await res.json();
  return {
    temperatura: data.current_weather.temperature,
    vento: data.current_weather.windspeed,
    previsao: data.daily.time.map((dia, i) => ({
      dia,
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
    })),
  };
}

async function buscarDolar() {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  const data = await res.json();
  return {
    compra: parseFloat(data.USDBRL.bid).toFixed(2),
    venda: parseFloat(data.USDBRL.ask).toFixed(2),
    variacao: parseFloat(data.USDBRL.pctChange).toFixed(2),
  };
}

async function buscarBitcoin() {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/BTC-BRL");
  const data = await res.json();
  return {
    preco: parseFloat(data.BTCBRL.bid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    variacao: parseFloat(data.BTCBRL.pctChange).toFixed(2),
  };
}

async function buscarNoticias() {
  const chave = process.env.NEWS_API_KEY;
  if (!chave) return [{ titulo: "Chave não configurada", fonte: "---" }];
  const res = await fetch(`https://newsdata.io/api/1/news?apikey=${chave}&country=br&language=pt&category=top`);
  const data = await res.json();
  if (!data.results || !Array.isArray(data.results)) return [];
  return data.results.slice(0, 5).map((n) => ({ titulo: n.title, fonte: n.source_id }));
}

// ─── INICIAR SERVIDOR ─────────────────────────────────
app.listen(3000, () => {
  console.log("✅ Servidor rodando em http://localhost:3000");
});