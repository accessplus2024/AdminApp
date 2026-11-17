// api/lib/modelProvider.js
//
// Qual API OpenAI-compatível o Sentinel usa para chamar modelos. O padrão
// continua sendo a API gratuita da NVIDIA (comportamento de produção
// inalterado), mas quem roda localmente pode apontar para qualquer provedor
// compatível — Ollama, LM Studio, OpenRouter, vLLM, a própria OpenAI etc.:
//
//   SENTINEL_BASE_URL=http://localhost:11434/v1   # ex.: Ollama
//   SENTINEL_API_KEY=ollama                        # qualquer valor não vazio
//   SENTINEL_MODELS=qwen3:14b
//
// Sem SENTINEL_BASE_URL, usa NVIDIA_API_KEY como antes.
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export function modelProviderConfig() {
  const baseURL = String(process.env.SENTINEL_BASE_URL || '').trim();
  if (baseURL) {
    const apiKey = String(process.env.SENTINEL_API_KEY || '').trim();
    if (!apiKey) throw new Error('SENTINEL_API_KEY não configurada (obrigatória quando SENTINEL_BASE_URL está definida; use qualquer valor para provedores locais sem chave).');
    return { baseURL, apiKey };
  }
  if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY não configurada no servidor.');
  return { baseURL: NVIDIA_BASE_URL, apiKey: process.env.NVIDIA_API_KEY };
}
