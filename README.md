# brunofhorn-studio

Worker que renderiza os conteúdos do **Estúdio** (menu _Perfis_ do admin). A API escreve o
conteúdo com a IA e põe na fila; este worker pega a fila, gera a mídia e devolve:

| Formato           | Como renderiza                                                                  | Saída                    |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Post e carrossel  | Abre o HTML dos slides (template da skill `carrossel`, montado pela API) no Chromium e fotografa cada `.slide` | JPG 1080x1350 por slide |
| Reel              | Template Remotion da skill `reel` ([reel/](reel/)) com o `cenas.json` que a API montou | MP4 1080x1920 + capa JPG |

Os arquivos vão direto para o bucket público do R2 por URL temporária; a API só autoriza.

## Rodar

Node 20.19+. O ffmpeg no PATH é opcional: com ele, `mixar.mjs` nivela o volume da trilha.

```bash
npm install
npm run setup          # Chromium do Playwright e o navegador do Remotion (uma vez)
cp .env.example .env   # STUDIO_API_URL e o mesmo STUDIO_WORKER_TOKEN da API
npm start              # fica consultando a fila (Ctrl+C termina depois do job atual)
npm run once           # renderiza o que estiver na fila e sai
npm run serve          # espera a API chamar POST /wake (é o modo do Docker)
```

Pode rodar no PC (só renderiza enquanto estiver ligado; agendar e publicar continuam na API)
ou num servidor. Mais de um worker pode rodar ao mesmo tempo: a API reserva cada job para um só.

## Railway (só gasta quando renderiza)

O [Dockerfile](Dockerfile) sobe o worker em modo `serve`: ele não consulta a fila, fica parado
até a API chamar `POST /wake`, renderiza tudo o que houver, fecha o Chromium e volta a ficar
parado. Sem tráfego de saída por 10 minutos, a Railway põe o serviço para dormir e ele deixa de
custar; a próxima chamada da API o acorda (leva alguns segundos).

1. Crie o serviço no **mesmo projeto** da API, a partir deste repositório. O
   [railway.json](railway.json) já liga o Serverless (_Settings › Serverless_); não gere domínio
   público.
2. Variáveis do worker:
   - `STUDIO_API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`
   - `STUDIO_WORKER_TOKEN=${{api.STUDIO_WORKER_TOKEN}}`
   - `PORT=8080`, `REMOTION_CONCURRENCY=2` e, se quiser narração, `ELEVENLABS_API_KEY`
3. Na API: `STUDIO_WORKER_URL=http://${{studio.RAILWAY_PRIVATE_DOMAIN}}:8080`.

Troque `api` e `studio` pelos nomes dos serviços no seu projeto. A API acorda o worker quando a
IA termina, quando um slide ou cena é editado e no botão "Renderizar de novo"; se a fila ficar
parada (o worker não acordou ou caiu no meio), o agendador da API tenta de novo a cada 5 minutos.

## Áudio dos reels

Segue a identidade do perfil (admin › Perfis › Briefing e marca):

- **Efeitos e trilha**: sintetizados por [scripts/gerar-audio.mjs](scripts/gerar-audio.mjs)
  (originais, sem licença a respeitar) e nivelados por `mixar.mjs` (precisa do ffmpeg).
- **Narração**: quando o conteúdo pede, `narrar.mjs` usa o ElevenLabs com a
  `ELEVENLABS_API_KEY` deste worker e a voz do perfil (ou `ELEVENLABS_VOICE_ID`). Sem chave, o
  reel sai sem voz, com a legenda animada.

`scripts/` e `reel/` são cópias da skill `reel`. Ao atualizar a skill, copie de novo
`template/src` para `reel/src` e os scripts para `scripts/`.

## Dicas

- Para mexer no visual do reel: `npm run studio` abre o Remotion Studio com `reel/cenas.json`.
- No Windows, o ponto de entrada do Remotion vai explícito (`reel/src/index.ts`): sem ele, o
  nome da composição `Reel` casa com a pasta `reel/` e o bundle falha com `EISDIR`.
