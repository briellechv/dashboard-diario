import fs from "fs";
import cron from "node-cron";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

// ─── CLIMA (Open-Meteo — sem chave) ───────────────────
async function buscarClima() {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=-1.45&longitude=-48.50&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America%2FBelem";

  const res = await fetch(url);
  const data = await res.json();
  const clima = data.current_weather;

  return {
    temperatura: clima.temperature,
    vento: clima.windspeed,
    previsao: data.daily.time.map((dia, i) => ({
      dia,
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
    })),
  };
}

// ─── DÓLAR (AwesomeAPI — sem chave) ───────────────────
async function buscarDolar() {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  const data = await res.json();
  const dolar = data.USDBRL;

  return {
    compra: parseFloat(dolar.bid).toFixed(2),
    venda: parseFloat(dolar.ask).toFixed(2),
    variacao: parseFloat(dolar.pctChange).toFixed(2),
  };
}

// _____ BITCOIN _____
async function buscarBitcoin() {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/BTC-BRL");
  const data = await res.json();
  const btc = data.BTCBRL;

  return {
    preco: parseFloat(btc.bid).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    variacao: parseFloat(btc.pctChange).toFixed(2),
  };
}

// ─── NOTÍCIAS (NewsData.io — chave gratuita) ──────────
async function buscarNoticias() {
  const chave = process.env.NEWS_API_KEY;

  if (!chave) {
    return [{ titulo: "Chave da API não configurada no .env", fonte: "---" }];
  }

  const url = `https://newsdata.io/api/1/news?apikey=${chave}&country=br&language=pt&category=top`;
  const res = await fetch(url, {
    headers: { "Accept-Charset": "utf-8" }
  });
  const data = await res.json();

  if (!data.results || !Array.isArray(data.results)) {
    return [{ titulo: "Não foi possível carregar notícias.", fonte: "---" }];
  }

  return data.results.slice(0, 5).map((n) => ({
    titulo: n.title,
    fonte: n.source_id,
  }));
}

// ─── EXIBIÇÃO NO TERMINAL ─────────────────────────────
function exibir(clima, dolar, noticias, bitcoin) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" });

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║       📋 RESUMO DO DIA               ║");
  console.log(`║  ${agora.padEnd(36)}║`);
  console.log("╚══════════════════════════════════════╝\n");

  console.log("🌤️  CLIMA (Belém/PA)");
  console.log(`   Agora: ${clima.temperatura}°C | Vento: ${clima.vento} km/h\n`);

  console.log("   📅 Previsão para os próximos 7 dias:");
  clima.previsao.forEach((d) => {
    console.log(`   ${d.dia}  → Máx: ${d.max}°C  Mín: ${d.min}°C`);
  });

  console.log("\n💵  DÓLAR (USD → BRL)");
  console.log(`   Compra  : R$ ${dolar.compra}`);
  console.log(`   Venda   : R$ ${dolar.venda}`);
  console.log(`   Variação: ${dolar.variacao}%`);

  console.log("\n₿   BITCOIN (BTC → BRL)");
  console.log(`   Preço   : ${bitcoin.preco}`);
  console.log(`   Variação: ${bitcoin.variacao}%`);

  console.log("\n📰  TOP NOTÍCIAS DO BRASIL");
  noticias.forEach((n, i) => {
    console.log(`   ${i + 1}. [${n.fonte}] ${n.titulo}`);
  });

  console.log("\n──────────────────────────────────────\n");
}

// ENVIAR AO DISCORD 
async function enviarDiscord(clima, dolar, noticias, bitcoin) {
  const webhook = process.env.DISCORD_WEBHOOK;

  if (!webhook) {
    console.log("⚠️ Webhook do Discord não configurado no .env");
    return;
  }

  const mensagem = `
📋 **RESUMO DO DIA — ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Belem" })}**

🌤️ **CLIMA (Belém/PA)**
> Agora: ${clima.temperatura}°C | Vento: ${clima.vento} km/h
> 📅 Previsão 7 dias:
${clima.previsao.map(d => `> ${d.dia} → Máx: ${d.max}°C | Mín: ${d.min}°C`).join("\n")}

💵 **DÓLAR (USD → BRL)**
> Compra: R$ ${dolar.compra} | Venda: R$ ${dolar.venda} | Variação: ${dolar.variacao}%

₿ **BITCOIN (BTC → BRL)**
> Preço: ${bitcoin.preco} | Variação: ${bitcoin.variacao}%

📰 **TOP NOTÍCIAS DO BRASIL**
${noticias.map((n, i) => `> ${i + 1}. [${n.fonte}] ${n.titulo}`).join("\n")}
  `.trim();

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: mensagem }),
  });

  console.log("✅ Resumo enviado para o Discord!");
}

// Salvar o histório 
function salvarHistorico(clima, dolar, noticias, bitcoin) {
  const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Belem" });
  const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Belem" });

  const conteudo = `
========================================
  RESUMO DO DIA — ${data} às ${hora}
========================================

🌤️ CLIMA (Belém/PA)
  Agora: ${clima.temperatura}°C | Vento: ${clima.vento} km/h

  Previsão 7 dias:
${clima.previsao.map(d => `  ${d.dia} → Máx: ${d.max}°C | Mín: ${d.min}°C`).join("\n")}

💵 DÓLAR (USD → BRL)
  Compra  : R$ ${dolar.compra}
  Venda   : R$ ${dolar.venda}
  Variação: ${dolar.variacao}%

₿ BITCOIN (BTC → BRL)
  Preço   : ${bitcoin.preco}
  Variação: ${bitcoin.variacao}%

📰 TOP NOTÍCIAS DO BRASIL
${noticias.map((n, i) => `  ${i + 1}. [${n.fonte}] ${n.titulo}`).join("\n")}

`.trimStart();

  // Cria a pasta historico se não existir
  if (!fs.existsSync("./historico")) {
    fs.mkdirSync("./historico");
  }

  // Salva o arquivo com a data no nome
  const nomeArquivo = `./historico/resumo-${data.replace(/\//g, "-")}.txt`;
  fs.appendFileSync(nomeArquivo, conteudo, "utf-8");

  console.log(`📄 Histórico salvo em: ${nomeArquivo}`);
}

// ─── EXECUÇÃO PRINCIPAL ───────────────────────────────
async function main() {
  console.log("⏳ Buscando dados...");

  try {
    const [clima, dolar, noticias, bitcoin] = await Promise.all([
      buscarClima(),
      buscarDolar(),
      buscarNoticias(),
      buscarBitcoin(),
    ]);

    exibir(clima, dolar, noticias, bitcoin);
    await enviarDiscord(clima, dolar, noticias, bitcoin);
    salvarHistorico(clima, dolar, noticias, bitcoin);
  } catch (erro) {
    console.error("❌ Erro ao buscar dados:", erro.message);
  }
}

// ─── AGENDAMENTO ──────────────────────────────────────
main();

cron.schedule("0 9 * * *", () => {
  console.log("\n🔄 Atualização automática das 8h!\n");
  main();
}, {
  timezone: "America/Belem"
});

console.log("✅ Agendador ativo — próxima atualização às 08:00");